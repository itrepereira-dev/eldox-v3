// backend/src/diario/rdo/rdo-avanco.service.ts
// Sprint B2 — Avanço Físico, Previsto×Realizado e Sincronização com Efetivo
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AvancoFisicoItem {
  orcamento_item_id: number;
  descricao: string;
  etapa: string | null;
  unidade: string;
  quantidade_orcada: number;
  quantidade_executada: number;
  percentual_avanco: number;
}

export interface AvancoFisicoResponse {
  obra_id: number;
  obra_nome: string;
  percentual_global: number;
  por_etapa: Record<string, { total: number; executado: number; percentual: number }>;
  itens: AvancoFisicoItem[];
}

export interface PrevistoRealizadoDia {
  data: string;
  atividades_previstas: number;
  atividades_realizadas: number;
  percentual_realizacao: number;
  horas_previstas: number;
  horas_realizadas: number;
  funcionarios_previstos: number;
  funcionarios_realizados: number;
}

export interface SincEfetivoResult {
  sincronizados: number;
  erros: number;
  detalhes: Array<{ rdo_mao_de_obra_id: number; efetivo_registro_id: number | null; erro?: string }>;
}

@Injectable()
export class RdoAvancoService {
  private readonly logger = new Logger(RdoAvancoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. Avanço Físico vs. Orçamento ──────────────────────────────────────

  async getAvancoFisico(tenantId: number, obraId: number): Promise<AvancoFisicoResponse> {
    // Verifica se a obra existe
    const obraRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, nome FROM "Obra" WHERE id = $1 AND "tenantId" = $2 AND "deletadoEm" IS NULL`,
      obraId,
      tenantId,
    );
    if (!obraRows.length) {
      throw new NotFoundException(`Obra ${obraId} não encontrada`);
    }
    const obra = obraRows[0];

    // Busca itens do orçamento ativo da obra
    const orcamentoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT oi.id, oi.descricao, oi.etapa, oi.unidade,
              COALESCE(oi.quantidade, 0) AS quantidade_orcada
       FROM alm_orcamento_itens oi
       JOIN alm_orcamentos o ON o.id = oi.orcamento_id
       WHERE o.obra_id = $1 AND o.tenant_id = $2
         AND o.deleted_at IS NULL
         AND oi.deleted_at IS NULL
       ORDER BY oi.etapa NULLS LAST, oi.id`,
      obraId,
      tenantId,
    );

    if (!orcamentoRows.length) {
      // Sem orçamento cadastrado — retorna estrutura vazia
      return {
        obra_id: obraId,
        obra_nome: obra.nome,
        percentual_global: 0,
        por_etapa: {},
        itens: [],
      };
    }

    // Busca quantidades executadas acumuladas de todos os RDOs aprovados
    const executadoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
         ra.orcamento_item_id,
         COALESCE(SUM(ra.quantidade_executada), 0) AS quantidade_executada
       FROM rdo_atividades ra
       JOIN rdos r ON r.id = ra.rdo_id
       WHERE r.obra_id = $1 AND r.tenant_id = $2
         AND r.status IN ('revisao', 'aprovado')
         AND r.deleted_at IS NULL
         AND ra.orcamento_item_id IS NOT NULL
       GROUP BY ra.orcamento_item_id`,
      obraId,
      tenantId,
    );

    const executadoMap: Record<number, number> = {};
    for (const e of executadoRows) {
      executadoMap[e.orcamento_item_id] = Number(e.quantidade_executada);
    }

    // Monta itens com percentual
    const itens: AvancoFisicoItem[] = orcamentoRows.map((oi) => {
      const qOrcada = Number(oi.quantidade_orcada);
      const qExecutada = executadoMap[oi.id] ?? 0;
      const pct = qOrcada > 0 ? Math.min(100, Math.round((qExecutada / qOrcada) * 1000) / 10) : 0;
      return {
        orcamento_item_id: oi.id,
        descricao: oi.descricao,
        etapa: oi.etapa,
        unidade: oi.unidade ?? '-',
        quantidade_orcada: qOrcada,
        quantidade_executada: qExecutada,
        percentual_avanco: pct,
      };
    });

    // Agrupa por etapa
    const porEtapa: Record<string, { total: number; executado: number; percentual: number }> = {};
    for (const item of itens) {
      const etapa = item.etapa ?? 'Sem etapa';
      if (!porEtapa[etapa]) {
        porEtapa[etapa] = { total: 0, executado: 0, percentual: 0 };
      }
      porEtapa[etapa].total += item.quantidade_orcada;
      porEtapa[etapa].executado += item.quantidade_executada;
    }
    for (const etapa of Object.keys(porEtapa)) {
      const e = porEtapa[etapa];
      e.percentual = e.total > 0 ? Math.min(100, Math.round((e.executado / e.total) * 1000) / 10) : 0;
    }

    // Percentual global: média ponderada por quantidade orçada
    const totalOrcado = itens.reduce((s, i) => s + i.quantidade_orcada, 0);
    const totalExec = itens.reduce((s, i) => s + i.quantidade_executada, 0);
    const pctGlobal = totalOrcado > 0 ? Math.min(100, Math.round((totalExec / totalOrcado) * 1000) / 10) : 0;

    return {
      obra_id: obraId,
      obra_nome: obra.nome,
      percentual_global: pctGlobal,
      por_etapa: porEtapa,
      itens,
    };
  }

  // ─── 2. Previsto × Realizado por Dia ─────────────────────────────────────

  async getPrevistoRealizado(
    tenantId: number,
    obraId: number,
    dataInicio: string,
    dataFim: string,
  ): Promise<PrevistoRealizadoDia[]> {
    // Busca todos os RDOs do período
    const rdos = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.id, r.data::text AS data, r.status,
              (SELECT COUNT(*) FROM rdo_atividades a WHERE a.rdo_id = r.id) AS atividades_lancadas,
              (SELECT COUNT(*) FROM rdo_atividades a WHERE a.rdo_id = r.id AND a.percentual_executado >= 100) AS atividades_concluidas,
              (SELECT COALESCE(SUM(m.quantidade), 0) FROM rdo_mao_de_obra m WHERE m.rdo_id = r.id) AS funcionarios_realizados,
              (SELECT COALESCE(SUM(m.horas_trabalhadas), 0) FROM rdo_mao_de_obra m WHERE m.rdo_id = r.id) AS horas_realizadas
       FROM rdos r
       WHERE r.obra_id = $1 AND r.tenant_id = $2
         AND r.data >= $3 AND r.data <= $4
         AND r.deleted_at IS NULL
       ORDER BY r.data ASC`,
      obraId,
      tenantId,
      dataInicio,
      dataFim,
    );

    // Busca planejamento (se módulo de planejamento estiver disponível)
    // Para cada data, tenta encontrar planejamento na tabela alm_planejamento_itens
    const planRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
         pi.data_prevista::text AS data,
         COUNT(*) AS atividades_previstas,
         COALESCE(SUM(pi.quantidade), 0) AS quantidade_prevista
       FROM alm_planejamento_itens pi
       JOIN alm_planejamentos p ON p.id = pi.planejamento_id
       WHERE p.obra_id = $1 AND p.tenant_id = $2
         AND pi.data_prevista >= $3 AND pi.data_prevista <= $4
       GROUP BY pi.data_prevista
       ORDER BY pi.data_prevista`,
      obraId,
      tenantId,
      dataInicio,
      dataFim,
    ).catch(() => [] as any[]);  // tabela pode não existir

    const planMap: Record<string, { atividades: number; horas: number; funcionarios: number }> = {};
    for (const p of planRows) {
      planMap[p.data] = {
        atividades: Number(p.atividades_previstas),
        horas: 0,      // planejamento não tem horas; pode ser expandido
        funcionarios: 0,
      };
    }

    return rdos.map((r) => {
      const plan = planMap[r.data] ?? { atividades: 0, horas: 0, funcionarios: 0 };
      const atividadesLancadas = Number(r.atividades_lancadas);
      return {
        data: r.data,
        atividades_previstas: plan.atividades,
        atividades_realizadas: atividadesLancadas,
        percentual_realizacao:
          plan.atividades > 0
            ? Math.min(100, Math.round((atividadesLancadas / plan.atividades) * 100))
            : 0,
        horas_previstas: plan.horas,
        horas_realizadas: Number(r.horas_realizadas),
        funcionarios_previstos: plan.funcionarios,
        funcionarios_realizados: Number(r.funcionarios_realizados),
      };
    });
  }

  // ─── 3. Sync: RDO Mão de Obra → Efetivo ──────────────────────────────────

  async sincronizarComEfetivo(
    tenantId: number,
    rdoId: number,
    usuarioId: number,
  ): Promise<SincEfetivoResult> {
    // Busca registros de mão de obra do RDO que ainda não têm efetivo_registro_id
    const maoObraRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT m.*, r.data AS rdo_data, r.obra_id
       FROM rdo_mao_de_obra m
       JOIN rdos r ON r.id = m.rdo_id
       WHERE m.rdo_id = $1 AND m.tenant_id = $2
         AND m.efetivo_registro_id IS NULL`,
      rdoId,
      tenantId,
    );

    if (!maoObraRows.length) {
      return { sincronizados: 0, erros: 0, detalhes: [] };
    }

    // Busca a obra do RDO
    const rdoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, obra_id, data FROM rdos WHERE id = $1 AND tenant_id = $2`,
      rdoId,
      tenantId,
    );
    if (!rdoRows.length) {
      throw new NotFoundException(`RDO ${rdoId} não encontrado`);
    }
    const rdo = rdoRows[0];

    const detalhes: SincEfetivoResult['detalhes'] = [];
    let sincronizados = 0;
    let erros = 0;

    for (const m of maoObraRows) {
      try {
        // Tenta encontrar funcionário no efetivo pelo nome/função
        // Busca na tabela efetivo_registros (ou similar — adapta ao schema existente)
        const funcionarioRows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM efetivo_registros
           WHERE tenant_id = $1 AND obra_id = $2
             AND data = $3 AND funcao = $4
           LIMIT 1`,
          tenantId,
          rdo.obra_id,
          rdo.data,
          m.funcao,
        ).catch(() => [] as any[]);

        let efetivoId: number | null = null;

        if (funcionarioRows.length) {
          // Já existe registro no efetivo — apenas vincula
          efetivoId = funcionarioRows[0].id;
        } else {
          // Cria novo registro no efetivo
          const novoRows = await this.prisma.$queryRawUnsafe<any[]>(
            `INSERT INTO efetivo_registros
               (tenant_id, obra_id, data, funcao, quantidade, hora_entrada, hora_saida,
                horas_trabalhadas, origem, criado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'rdo', $9)
             RETURNING id`,
            tenantId,
            rdo.obra_id,
            rdo.data,
            m.funcao,
            m.quantidade,
            m.hora_entrada ?? null,
            m.hora_saida ?? null,
            m.horas_trabalhadas ?? null,
            usuarioId,
          ).catch(() => [] as any[]);

          if (novoRows.length) {
            efetivoId = novoRows[0].id;
          }
        }

        if (efetivoId) {
          // Atualiza efetivo_registro_id no registro de mão de obra do RDO
          await this.prisma.$executeRawUnsafe(
            `UPDATE rdo_mao_de_obra SET efetivo_registro_id = $1 WHERE id = $2 AND tenant_id = $3`,
            efetivoId,
            m.id,
            tenantId,
          );
          detalhes.push({ rdo_mao_de_obra_id: m.id, efetivo_registro_id: efetivoId });
          sincronizados++;
        } else {
          detalhes.push({
            rdo_mao_de_obra_id: m.id,
            efetivo_registro_id: null,
            erro: 'Não foi possível criar registro no efetivo',
          });
          erros++;
        }
      } catch (err) {
        detalhes.push({
          rdo_mao_de_obra_id: m.id,
          efetivo_registro_id: null,
          erro: err instanceof Error ? err.message : String(err),
        });
        erros++;
      }
    }

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'rdo.avanco.sinc_efetivo',
        rdo_id: rdoId,
        tenant_id: tenantId,
        sincronizados,
        erros,
      }),
    );

    return { sincronizados, erros, detalhes };
  }

  // ─── 4. Registrar quantidade executada numa atividade ─────────────────────

  async registrarQuantidadeExecutada(
    tenantId: number,
    rdoId: number,
    atividadeId: number,
    orcamentoItemId: number,
    quantidadeExecutada: number,
  ): Promise<void> {
    // Validações
    const rdoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, status FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      rdoId,
      tenantId,
    );
    if (!rdoRows.length) throw new NotFoundException(`RDO ${rdoId} não encontrado`);
    if (rdoRows[0].status === 'aprovado') {
      throw new BadRequestException('RDO aprovado não pode ser editado');
    }

    // Verifica que o item do orçamento existe e pertence ao tenant
    const itemRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT oi.id FROM alm_orcamento_itens oi
       JOIN alm_orcamentos o ON o.id = oi.orcamento_id
       WHERE oi.id = $1 AND o.tenant_id = $2`,
      orcamentoItemId,
      tenantId,
    );
    if (!itemRows.length) {
      throw new NotFoundException(`Item de orçamento ${orcamentoItemId} não encontrado`);
    }

    // Atualiza a atividade
    await this.prisma.$executeRawUnsafe(
      `UPDATE rdo_atividades
       SET orcamento_item_id = $1, quantidade_executada = $2
       WHERE id = $3 AND rdo_id = $4 AND tenant_id = $5`,
      orcamentoItemId,
      quantidadeExecutada,
      atividadeId,
      rdoId,
      tenantId,
    );
  }
}
