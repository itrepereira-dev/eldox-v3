// backend/src/diario/rdo/rdo-ia.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RdoSugestaoIa, AcaoSugestaoIa, CondicaoClima } from './types/rdo.types';
import type { AplicarSugestaoDto } from './dto/aplicar-sugestao.dto';
import { AgenteValidador } from '../../ai/agents/rdo/agente-validador';
import { AgenteResumo } from '../../ai/agents/rdo/agente-resumo';
import { AgenteAlerta } from '../../ai/agents/rdo/agente-alerta';

interface SugestaoClima {
  periodo: string;
  condicao: string;
  praticavel: boolean;
  chuva_mm?: number;
  confianca: number;
  fonte: string;
}

interface SugestaoEquipe {
  funcao: string;
  quantidade: number;
  tipo: string;
  confianca: number;
  base: string;
}

interface SugestaoAtividade {
  descricao: string;
  pavimento?: string;
  servico?: string;
  confianca: number;
}

interface ResultadoAgentesIniciais {
  clima: SugestaoClima[] | null;
  equipe: SugestaoEquipe[] | null;
  atividades: SugestaoAtividade[] | null;
}

@Injectable()
export class RdoIaService {
  private readonly logger = new Logger(RdoIaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agenteValidador: AgenteValidador,
    private readonly agenteResumo: AgenteResumo,
    private readonly agenteAlerta: AgenteAlerta,
  ) {}

  /**
   * ADR-RDO-004: Executa agentes iniciais em paralelo e salva sugestões.
   * NÃO aplica automaticamente — apenas registra para o usuário decidir.
   */
  async acionarAgentesIniciais(
    rdoId: number,
    tenantId: number,
  ): Promise<ResultadoAgentesIniciais> {
    const start = Date.now();

    const [clima, equipe, atividades] = await Promise.allSettled([
      this.executarAgenteClima(rdoId, tenantId),
      this.executarAgenteEquipe(rdoId, tenantId),
      this.executarAgenteAtividades(rdoId, tenantId),
    ]);

    const resultado: ResultadoAgentesIniciais = {
      clima: clima.status === 'fulfilled' ? clima.value : null,
      equipe: equipe.status === 'fulfilled' ? equipe.value : null,
      atividades: atividades.status === 'fulfilled' ? atividades.value : null,
    };

    // Salvar sugestões em rdo_sugestoes_ia
    await this.salvarSugestoes(rdoId, tenantId, resultado);

    const ms = Date.now() - start;
    this.logger.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date(),
        tenant_id: tenantId,
        action: 'rdo.ia.agentes_iniciais',
        rdo_id: rdoId,
        clima_ok: clima.status === 'fulfilled',
        equipe_ok: equipe.status === 'fulfilled',
        atividades_ok: atividades.status === 'fulfilled',
        ms,
      }),
    );

    return resultado;
  }

  /**
   * AGENTE-CLIMA: Sugere condições climáticas com base em Open-Meteo API.
   * Busca coordenadas da obra e data do RDO, chama a API de previsão e
   * mapeia weathercode → CondicaoClima para os 3 períodos do dia.
   */
  private async executarAgenteClima(
    rdoId: number,
    tenantId: number,
  ): Promise<SugestaoClima[]> {
    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'rdo.ia.agente_clima',
        rdo_id: rdoId,
        tenant_id: tenantId,
      }),
    );

    // 1. Buscar data e coordenadas da obra via JOIN
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ data: Date; latitude: number | null; longitude: number | null }>
    >(
      `SELECT r.data, o.latitude, o.longitude
       FROM rdos r
       JOIN "Obra" o ON o.id = r.obra_id
       WHERE r.id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL`,
      rdoId,
      tenantId,
    );

    if (!rows.length || rows[0].latitude == null || rows[0].longitude == null) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          action: 'rdo.ia.agente_clima.sem_coordenadas',
          rdo_id: rdoId,
          tenant_id: tenantId,
        }),
      );
      return [];
    }

    const { data, latitude, longitude } = rows[0];
    // Formatar data como YYYY-MM-DD para a API
    const dataStr =
      data instanceof Date
        ? data.toISOString().slice(0, 10)
        : String(data).slice(0, 10);

    // 2. Chamar Open-Meteo API (Node 18+ built-in fetch)
    let condicao: CondicaoClima = 'nublado';
    let chuva_mm = 0;

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&daily=weathercode,precipitation_sum` +
        `&timezone=America%2FSao_Paulo` +
        `&start_date=${dataStr}&end_date=${dataStr}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        daily?: {
          weathercode?: number[];
          precipitation_sum?: number[];
        };
      };

      const weathercode = payload.daily?.weathercode?.[0] ?? null;
      const precipitation = payload.daily?.precipitation_sum?.[0] ?? 0;

      chuva_mm = Math.round((precipitation ?? 0) * 10) / 10;

      // 3. Mapear weathercode → CondicaoClima
      if (weathercode !== null) {
        if (weathercode <= 1) {
          condicao = 'ensolarado';
        } else if (weathercode === 2) {
          condicao = 'parcialmente_nublado';
        } else if (weathercode === 3) {
          condicao = 'nublado';
        } else if (
          (weathercode >= 51 && weathercode <= 67) ||
          (weathercode >= 80 && weathercode <= 82)
        ) {
          condicao = 'chuvoso';
        } else if (weathercode >= 95 && weathercode <= 99) {
          condicao = 'tempestade';
        } else {
          condicao = 'nublado';
        }
      }
    } catch (err) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          action: 'rdo.ia.agente_clima.fetch_error',
          rdo_id: rdoId,
          tenant_id: tenantId,
          error: String(err),
        }),
      );
      return [];
    }

    // 4. Criar 3 sugestões (manha, tarde, noite) com mesma condição diária
    const praticavel = condicao !== 'chuvoso' && condicao !== 'tempestade';
    const periodos: Array<SugestaoClima> = (['manha', 'tarde', 'noite'] as const).map(
      (periodo) => ({
        periodo,
        condicao,
        praticavel,
        chuva_mm,
        confianca: 0.85,
        fonte: 'open-meteo',
      }),
    );

    return periodos;
  }

  /**
   * AGENTE-EQUIPE: Sugere composição de equipe com base nos últimos 5 RDOs
   * da mesma obra (histórico de mão de obra aggregado por função/tipo).
   */
  private async executarAgenteEquipe(
    rdoId: number,
    tenantId: number,
  ): Promise<SugestaoEquipe[]> {
    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'rdo.ia.agente_equipe',
        rdo_id: rdoId,
        tenant_id: tenantId,
      }),
    );

    // 1. Buscar obra_id do RDO atual
    const obraRows = await this.prisma.$queryRawUnsafe<Array<{ obra_id: number }>>(
      `SELECT obra_id FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      rdoId,
      tenantId,
    );

    if (!obraRows.length) {
      return [];
    }

    const { obra_id } = obraRows[0];

    // 2. Buscar agregado de mão de obra dos últimos 5 RDOs da mesma obra
    //    (excluindo o RDO atual, exige pelo menos 2 ocorrências por função/tipo)
    const agregado = await this.prisma.$queryRawUnsafe<
      Array<{ funcao: string; tipo: string; quantidade_media: number }>
    >(
      `SELECT m.funcao, m.tipo, ROUND(AVG(m.quantidade)) AS quantidade_media
       FROM rdo_mao_de_obra m
       JOIN (
         SELECT id FROM rdos
         WHERE obra_id = $1
           AND tenant_id = $2
           AND deleted_at IS NULL
           AND id != $3
         ORDER BY data DESC
         LIMIT 5
       ) recent ON recent.id = m.rdo_id
       GROUP BY m.funcao, m.tipo
       HAVING COUNT(*) >= 2`,
      obra_id,
      tenantId,
      rdoId,
    );

    if (!agregado.length) {
      return [];
    }

    return agregado.map((row) => ({
      funcao: row.funcao,
      quantidade: Number(row.quantidade_media),
      tipo: row.tipo,
      confianca: 0.70,
      base: 'historico_5_rdos',
    }));
  }

  /**
   * AGENTE-ATIVIDADES: Sugere atividades com base nas descrições mais
   * frequentes dos últimos 10 RDOs da mesma obra (histórico de atividades).
   */
  private async executarAgenteAtividades(
    rdoId: number,
    tenantId: number,
  ): Promise<SugestaoAtividade[]> {
    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'rdo.ia.agente_atividades',
        rdo_id: rdoId,
        tenant_id: tenantId,
      }),
    );

    try {
      // 1. Buscar obra_id do RDO atual
      const obraRows = await this.prisma.$queryRawUnsafe<Array<{ obra_id: number }>>(
        `SELECT obra_id FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        rdoId,
        tenantId,
      );

      if (!obraRows.length) {
        return [];
      }

      const { obra_id } = obraRows[0];

      // 2. Buscar as descrições de atividades mais frequentes dos últimos 10 RDOs
      //    da mesma obra (excluindo o RDO atual), top 8 por frequência
      const rows = await this.prisma.$queryRawUnsafe<Array<{ descricao: string; frequencia: number }>>(
        `SELECT a.descricao, COUNT(*) AS frequencia
         FROM rdo_atividades a
         JOIN (
           SELECT id FROM rdos
           WHERE obra_id = $1
             AND tenant_id = $2
             AND deleted_at IS NULL
             AND id != $3
           ORDER BY data DESC
           LIMIT 10
         ) recent ON recent.id = a.rdo_id
         GROUP BY a.descricao
         ORDER BY frequencia DESC
         LIMIT 8`,
        obra_id,
        tenantId,
        rdoId,
      );

      if (!rows.length) {
        return [];
      }

      return rows.map((row, idx) => ({
        descricao: row.descricao,
        confianca: Math.max(0.5, 1 - idx * 0.06),
      }));
    } catch (err) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          action: 'rdo.ia.agente_atividades.error',
          rdo_id: rdoId,
          tenant_id: tenantId,
          error: String(err),
        }),
      );
      return [];
    }
  }

  /**
   * AGENTE-VALIDADOR: Retorna inconsistências SEM salvar (ADR-RDO-004).
   */
  async validarRdo(rdoId: number, tenantId: number): Promise<{ pode_enviar: boolean; inconsistencias: any[] }> {
    // 1. Load full RDO
    const rdoRows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT r.*,
         (SELECT json_agg(c) FROM rdo_clima c WHERE c.rdo_id = r.id) as clima,
         (SELECT json_agg(m) FROM rdo_mao_de_obra m WHERE m.rdo_id = r.id) as mao_obra,
         (SELECT json_agg(a) FROM rdo_atividades a WHERE a.rdo_id = r.id) as atividades,
         (SELECT json_agg(o) FROM rdo_ocorrencias o WHERE o.rdo_id = r.id) as ocorrencias
       FROM rdos r
       WHERE r.id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL`,
      rdoId, tenantId
    );
    if (!rdoRows.length) throw new NotFoundException(`RDO ${rdoId} não encontrado`);
    const rdo = rdoRows[0];

    // 2. Get obra_id for context
    const obraId = Number(rdo['obra_id']);

    // 3. Use system user id 0 for validator (no rate limit per user here — use tenantId)
    try {
      const resultado = await this.agenteValidador.executar({
        obra_id: obraId,
        tenant_id: tenantId,
        usuario_id: 0,
        rdo: rdo,
      });
      return {
        pode_enviar: resultado.pode_enviar,
        inconsistencias: resultado.inconsistencias,
      };
    } catch (err) {
      this.logger.warn(JSON.stringify({
        level: 'warn',
        action: 'rdo.ia.validar.error',
        rdo_id: rdoId,
        tenant_id: tenantId,
        error: String(err),
      }));
      return { pode_enviar: false, inconsistencias: [] };
    }
  }

  /**
   * AGENTE-RESUMO: Gera resumo executivo do RDO aprovado.
   */
  async gerarResumo(rdoId: number, tenantId: number): Promise<string> {
    // 1. Load RDO
    const rdoRows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT r.*,
         (SELECT json_agg(c) FROM rdo_clima c WHERE c.rdo_id = r.id) as clima,
         (SELECT json_agg(m) FROM rdo_mao_de_obra m WHERE m.rdo_id = r.id) as mao_obra,
         (SELECT json_agg(a) FROM rdo_atividades a WHERE a.rdo_id = r.id) as atividades,
         (SELECT json_agg(o) FROM rdo_ocorrencias o WHERE o.rdo_id = r.id) as ocorrencias
       FROM rdos r
       WHERE r.id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL`,
      rdoId, tenantId
    );
    if (!rdoRows.length) return '';
    const rdo = rdoRows[0];

    // 2. Execute agent
    try {
      const resultado = await this.agenteResumo.executar({
        obra_id: Number(rdo['obra_id']),
        tenant_id: tenantId,
        usuario_id: 0,
        rdo_id: rdoId,
        rdo: rdo,
        data_rdo: String(rdo['data']).slice(0, 10),
      });
      if (resultado.texto) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE rdos SET resumo_ia = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
          resultado.texto, rdoId, tenantId
        );
      }
      return resultado.texto;
    } catch (err) {
      this.logger.warn(JSON.stringify({
        level: 'warn',
        action: 'rdo.ia.gerar_resumo.error',
        rdo_id: rdoId,
        tenant_id: tenantId,
        error: String(err),
      }));
      return '';
    }
  }

  /**
   * AGENTE-ALERTA: Retorna alertas ativos para todas as obras do tenant.
   */
  async getAlertasObra(tenantId: number, usuarioId: number): Promise<{ alertas: any[]; fonte: string }> {
    const resultado = await this.agenteAlerta.executar({
      tenant_id: tenantId,
      sistema_usuario_id: usuarioId,
      data_referencia: new Date().toISOString(),
    });
    return { alertas: resultado.alertas, fonte: resultado.fonte };
  }

  /**
   * Retorna sugestões IA pendentes (sem ação do usuário) para um RDO.
   * Usado pelo endpoint GET /rdos/:id/sugestoes.
   */
  async buscarSugestoesPendentes(
    rdoId: number,
    tenantId: number,
  ): Promise<Array<{ id: number; agente: string; campo_afetado: string; valor_sugerido: any; created_at: Date }>> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: number; agente: string; campo_afetado: string; valor_sugerido: any; created_at: Date }>
    >(
      `SELECT id, agente, campo_afetado, valor_sugerido, created_at
       FROM rdo_sugestoes_ia
       WHERE rdo_id = $1 AND tenant_id = $2 AND acao IS NULL
       ORDER BY created_at ASC`,
      rdoId,
      tenantId,
    );

    return rows;
  }

  /**
   * Salva sugestões dos agentes em rdo_sugestoes_ia.
   */
  private async salvarSugestoes(
    rdoId: number,
    tenantId: number,
    resultado: ResultadoAgentesIniciais,
  ): Promise<void> {
    const entradas: Array<{ agente: string; campo: string; valor: any }> = [];

    if (resultado.clima?.length) {
      entradas.push({ agente: 'AGENTE-CLIMA', campo: 'clima', valor: resultado.clima });
    }
    if (resultado.equipe?.length) {
      entradas.push({ agente: 'AGENTE-EQUIPE', campo: 'mao_obra', valor: resultado.equipe });
    }
    if (resultado.atividades?.length) {
      entradas.push({ agente: 'AGENTE-ATIVIDADES', campo: 'atividades', valor: resultado.atividades });
    }

    for (const entrada of entradas) {
      // TODO: ajustar colunas conforme schema final
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO rdo_sugestoes_ia (rdo_id, tenant_id, agente, campo_afetado, valor_sugerido)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        rdoId,
        tenantId,
        entrada.agente,
        entrada.campo,
        JSON.stringify(entrada.valor),
      );
    }
  }

  /**
   * Registra que o usuário aplicou, ignorou ou editou uma sugestão IA.
   * Grava em rdo_sugestoes_ia + rdo_log_edicoes (ADR-RDO-004).
   */
  async registrarAcaoSugestao(
    rdoId: number,
    tenantId: number,
    usuarioId: number,
    dto: AplicarSugestaoDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Atualizar sugestão
      // TODO: ajustar WHERE para identificar sugestão correta conforme schema
      await tx.$executeRawUnsafe(
        `UPDATE rdo_sugestoes_ia
         SET acao = $1, valor_aplicado = $2::jsonb
         WHERE rdo_id = $3 AND tenant_id = $4 AND agente = $5 AND campo_afetado = $6
           AND acao IS NULL`,
        dto.acao,
        JSON.stringify(dto.valor_aplicado),
        rdoId,
        tenantId,
        dto.agente,
        dto.campo,
      );

      // Gravar em rdo_log_edicoes
      await tx.$executeRawUnsafe(
        `INSERT INTO rdo_log_edicoes
           (rdo_id, tenant_id, usuario_id, campo, valor_novo, via)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        rdoId,
        tenantId,
        usuarioId,
        `ia.${dto.campo}`,
        JSON.stringify({ agente: dto.agente, acao: dto.acao, valor: dto.valor_aplicado }),
        'sugestao_ia',
      );
    });

    this.logger.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date(),
        tenant_id: tenantId,
        user_id: usuarioId,
        action: 'rdo.ia.acao_sugestao',
        rdo_id: rdoId,
        agente: dto.agente,
        campo: dto.campo,
        acao_usuario: dto.acao,
      }),
    );
  }
}
