// backend/src/concretagem/caminhoes/caminhoes.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCaminhaoDto } from './dto/create-caminhao.dto';
import type { RegistrarSlumpDto } from './dto/registrar-slump.dto';
import type { PatchCaminhaoDto } from './dto/patch-caminhao.dto';

@Injectable()
export class CaminhoesService {
  private readonly logger = new Logger(CaminhoesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Registrar chegada de caminhão ────────────────────────────────────────

  async registrarChegada(
    tenantId: number,
    concrtagemId: number,
    userId: number,
    dto: CreateCaminhaoDto,
  ) {
    const concretagem = await this.buscarConcretagem(tenantId, concrtagemId);

    if (concretagem.status === 'CANCELADA') {
      throw new BadRequestException('Concretagem está cancelada');
    }

    // Verifica NF vencida: data_emissao_nf < data_programada - 1 dia
    const dataEmissao = new Date(dto.data_emissao_nf);
    const dataProgramada = new Date(concretagem.data_programada as string);
    const limite = new Date(dataProgramada);
    limite.setDate(limite.getDate() - 1);
    const nfVencida = dataEmissao < limite;

    // Próxima sequência
    const seqRows = await this.prisma.$queryRawUnsafe<{ seq: number }[]>(
      `SELECT COALESCE(MAX(sequencia), 0) + 1 AS seq FROM caminhoes_concreto WHERE tenant_id = $1 AND concretagem_id = $2`,
      tenantId,
      concrtagemId,
    );
    const sequencia = Number(seqRows[0]?.seq ?? 1);

    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO caminhoes_concreto
         (tenant_id, concretagem_id, sequencia, numero_nf, data_emissao_nf, volume,
          motorista, placa, hora_carregamento, hora_chegada, hora_inicio_lancamento, hora_fim_lancamento,
          elemento_lancado, elementos_lancados, slump_especificado, slump_medido, temperatura, incidentes,
          nf_vencida, registrado_por,
          nao_descarregou, responsabilidade_concreteira, lacre_aprovado,
          fator_ac, flow, ensaio_j, sobra_tipo, sobra_volume, foto_nf_url,
          numero_bt, lancamento_parcial,
          updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,NOW())
       RETURNING id`,
      tenantId,
      concrtagemId,
      sequencia,
      dto.numero_nf,
      dto.data_emissao_nf,
      dto.volume,
      dto.motorista ?? null,
      dto.placa ?? null,
      dto.hora_carregamento ?? null,
      dto.hora_chegada ?? null,
      dto.hora_inicio_lancamento ?? null,
      dto.hora_fim_lancamento ?? null,
      dto.elemento_lancado ?? (dto.elementos_lancados?.[0] ?? null),  // backward compat
      dto.elementos_lancados?.length ? `{${dto.elementos_lancados.map(e => `"${e.replace(/"/g, '\\"')}"`).join(',')}}` : null,
      dto.slump_especificado ?? null,
      dto.slump_medido ?? null,
      dto.temperatura ?? null,
      dto.incidentes ?? null,
      nfVencida,
      userId,
      dto.nao_descarregou ?? false,
      dto.responsabilidade_concreteira ?? false,
      dto.lacre_aprovado ?? null,
      dto.fator_ac ?? null,
      dto.flow ?? null,
      dto.ensaio_j ?? null,
      dto.sobra_tipo ?? null,
      dto.sobra_volume ?? null,
      dto.foto_nf_url ?? null,
      dto.numero_bt ?? null,
      dto.lancamento_parcial ?? false,
    );

    // Atualiza status da concretagem para EM_LANCAMENTO se PROGRAMADA
    if (concretagem.status === 'PROGRAMADA') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE concretagens SET status = 'EM_LANCAMENTO'::"StatusConcretagem", updated_at = NOW() WHERE tenant_id = $1 AND id = $2`,
        tenantId,
        concrtagemId,
      );
    }

    // NC automática se NF vencida
    if (nfVencida) {
      void this.abrirNcAutomatica(
        tenantId,
        concretagem.obra_id as number,
        rows[0].id,
        userId,
        'NF_VENCIDA',
        `Nota fiscal ${dto.numero_nf} com data de emissão ${dto.data_emissao_nf} anterior à data programada da concretagem.`,
      ).catch((e: unknown) => this.logger.error(`NC automática falhou: ${e}`));
    }

    this.auditLog(tenantId, userId, 'CREATE', rows[0].id, null, dto).catch(
      (e: unknown) => this.logger.error(`auditLog caminhão falhou: ${e}`),
    );

    return this.buscarCaminhao(tenantId, rows[0].id);
  }

  // ── Registrar slump ──────────────────────────────────────────────────────

  async registrarSlump(
    tenantId: number,
    caminhaoId: number,
    userId: number,
    dto: RegistrarSlumpDto,
  ) {
    const caminhao = await this.buscarCaminhao(tenantId, caminhaoId);
    const concretagem = await this.buscarConcretagem(tenantId, caminhao.concretagem_id as number);

    const sets: string[] = ['slump_medido = $3', 'updated_at = NOW()'];
    const params: unknown[] = [tenantId, caminhaoId, dto.slump_medido];
    let idx = 4;

    if (dto.temperatura !== undefined) {
      sets.push(`temperatura = $${idx++}`);
      params.push(dto.temperatura);
    }
    if (dto.incidentes !== undefined) {
      sets.push(`incidentes = $${idx++}`);
      params.push(dto.incidentes);
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE caminhoes_concreto SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
      ...params,
    );

    // NC automática se slump fora da tolerância (± 2cm do especificado)
    const slumpEspec = caminhao.slump_especificado as number | null;
    if (slumpEspec !== null) {
      const diff = Math.abs(dto.slump_medido - slumpEspec);
      if (diff > 2) {
        void this.abrirNcAutomatica(
          tenantId,
          concretagem.obra_id as number,
          caminhaoId,
          userId,
          'SLUMP_FORA_TOLERANCIA',
          `Slump medido ${dto.slump_medido}cm fora da tolerância (especificado: ${slumpEspec}cm, diferença: ${diff.toFixed(1)}cm).`,
        ).catch((e: unknown) => this.logger.error(`NC automática slump falhou: ${e}`));
      }
    }

    this.auditLog(tenantId, userId, 'SLUMP', caminhaoId, caminhao, dto).catch(
      (e: unknown) => this.logger.error(`auditLog slump falhou: ${e}`),
    );

    return this.buscarCaminhao(tenantId, caminhaoId);
  }

  // ── Concluir lançamento ──────────────────────────────────────────────────

  async concluirLancamento(tenantId: number, caminhaoId: number, userId: number) {
    await this.buscarCaminhao(tenantId, caminhaoId);

    const caminhao = await this.buscarCaminhao(tenantId, caminhaoId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE caminhoes_concreto SET status = 'CONCLUIDO'::"StatusCaminhao", updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      caminhaoId,
    );

    // Verificar se todos os caminhões estão concluídos/rejeitados
    const concretagem = await this.buscarConcretagem(tenantId, caminhao.concretagem_id as number);
    if ((concretagem.status as string) === 'EM_LANCAMENTO') {
      const pendentes = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
        `SELECT COUNT(*)::int AS total
         FROM caminhoes_concreto
         WHERE tenant_id = $1 AND concretagem_id = $2
           AND status NOT IN ('CONCLUIDO', 'REJEITADO')`,
        tenantId,
        concretagem.id,
      );
      if (Number(pendentes[0]?.total ?? 1) === 0) {
        await this.prisma.$queryRawUnsafe(
          `UPDATE concretagens
           SET status = 'EM_RASTREABILIDADE'::"StatusConcretagem", updated_at = NOW()
           WHERE tenant_id = $1 AND id = $2`,
          tenantId,
          concretagem.id,
        );
        this.logger.log(`Concretagem ${concretagem.id as number} → EM_RASTREABILIDADE (todos caminhões concluídos)`);
      }
    }

    this.auditLog(tenantId, userId, 'CONCLUIR', caminhaoId, null, null).catch(
      (e: unknown) => this.logger.error(`auditLog concluir falhou: ${e}`),
    );

    return this.buscarCaminhao(tenantId, caminhaoId);
  }

  // ── Rejeitar caminhão ────────────────────────────────────────────────────

  async rejeitar(
    tenantId: number,
    caminhaoId: number,
    userId: number,
    motivo: string,
  ) {
    const caminhao = await this.buscarCaminhao(tenantId, caminhaoId);
    const concretagem = await this.buscarConcretagem(tenantId, caminhao.concretagem_id as number);

    await this.prisma.$executeRawUnsafe(
      `UPDATE caminhoes_concreto SET status = 'REJEITADO'::"StatusCaminhao", incidentes = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      caminhaoId,
      motivo,
    );

    // NC automática para rejeição
    void this.abrirNcAutomatica(
      tenantId,
      concretagem.obra_id as number,
      caminhaoId,
      userId,
      'CAMINHAO_REJEITADO',
      `Caminhão NF ${caminhao.numero_nf as string} rejeitado. Motivo: ${motivo}`,
    ).catch((e: unknown) => this.logger.error(`NC automática rejeição falhou: ${e}`));

    this.auditLog(tenantId, userId, 'REJEITAR', caminhaoId, null, { motivo }).catch(
      (e: unknown) => this.logger.error(`auditLog rejeitar falhou: ${e}`),
    );

    return this.buscarCaminhao(tenantId, caminhaoId);
  }

  // ── Toggle não descarregou ───────────────────────────────────────────────

  async toggleNaoDescarregou(
    tenantId: number,
    caminhaoId: number,
    userId: number,
    responsabilidadeConcreteira?: boolean,
  ) {
    await this.buscarCaminhao(tenantId, caminhaoId);
    const rows = await this.prisma.$queryRawUnsafe<{ nao_descarregou: boolean }[]>(
      `UPDATE caminhoes_concreto
       SET nao_descarregou = NOT nao_descarregou,
           responsabilidade_concreteira = COALESCE($3, responsabilidade_concreteira),
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2
       RETURNING nao_descarregou`,
      tenantId, caminhaoId, responsabilidadeConcreteira ?? null,
    );
    this.auditLog(tenantId, userId, 'TOGGLE_NAO_DESCARREGOU', caminhaoId, null, rows[0]).catch(
      (e: unknown) => this.logger.error(`auditLog falhou: ${e}`),
    );
    return rows[0];
  }

  // ── Set lacre ────────────────────────────────────────────────────────────

  async setLacre(tenantId: number, caminhaoId: number, userId: number, aprovado: boolean) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE caminhoes_concreto SET lacre_aprovado = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2`,
      tenantId, caminhaoId, aprovado,
    );
    this.auditLog(tenantId, userId, 'SET_LACRE', caminhaoId, null, { lacre_aprovado: aprovado }).catch(
      (e: unknown) => this.logger.error(`auditLog falhou: ${e}`),
    );
    return this.buscarCaminhao(tenantId, caminhaoId);
  }

  // ── Patch caminhão ───────────────────────────────────────────────────────

  async patchCaminhao(tenantId: number, caminhaoId: number, userId: number, dto: PatchCaminhaoDto) {
    const fieldMap: Record<string, string> = {
      fator_ac: 'fator_ac',
      flow: 'flow',
      ensaio_j: 'ensaio_j',
      sobra_tipo: 'sobra_tipo',
      sobra_volume: 'sobra_volume',
      foto_nf_url: 'foto_nf_url',
      numero_bt: 'numero_bt',
      hora_carregamento: 'hora_carregamento',
      lancamento_parcial: 'lancamento_parcial',
      elementos_lancados: 'elementos_lancados',
    };
    const sets: string[] = [];
    const params: unknown[] = [tenantId, caminhaoId];
    let idx = 3;
    for (const [key, col] of Object.entries(fieldMap)) {
      const val = (dto as Record<string, unknown>)[key];
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        if (key === 'elementos_lancados' && Array.isArray(val)) {
          params.push(`{${(val as string[]).map(e => `"${e.replace(/"/g, '\\"')}"`).join(',')}}`);
        } else {
          params.push(val ?? null);
        }
      }
    }
    if (!sets.length) return this.buscarCaminhao(tenantId, caminhaoId);
    sets.push('updated_at = NOW()');
    await this.prisma.$executeRawUnsafe(
      `UPDATE caminhoes_concreto SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
      ...params,
    );
    this.auditLog(tenantId, userId, 'PATCH', caminhaoId, null, dto).catch(
      (e: unknown) => this.logger.error(`auditLog falhou: ${e}`),
    );
    return this.buscarCaminhao(tenantId, caminhaoId);
  }

  // ── Buscar caminhão ──────────────────────────────────────────────────────

  async buscarCaminhao(tenantId: number, id: number) {
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM caminhoes_concreto WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      id,
    );
    if (!rows[0]) throw new NotFoundException('Caminhão não encontrado');
    return rows[0];
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  private async buscarConcretagem(tenantId: number, concrtagemId: number): Promise<Record<string, unknown>> {
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, obra_id, status, data_programada FROM concretagens WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      tenantId,
      concrtagemId,
    );
    if (!rows[0]) throw new NotFoundException('Concretagem não encontrada');
    return rows[0];
  }

  private async abrirNcAutomatica(
    tenantId: number,
    obraId: number,
    caminhaoId: number,
    userId: number,
    tipo: string,
    descricao: string,
  ): Promise<void> {
    // NC automática — número usa o SERIAL id para evitar race condition
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO nao_conformidades
           (tenant_id, obra_id, numero, categoria, criticidade, titulo, descricao,
            status, caminhao_id, aberta_por, updated_at)
         VALUES ($1,$2,'TEMP','CONCRETAGEM'::"NcCategoria",'MEDIA'::"NcCriticidade",$3,$4,
                 'ABERTA'::"NcStatus",$5,$6,NOW())
         RETURNING id`,
        tenantId,
        obraId,
        `NC Automática — ${tipo}`,
        descricao,
        caminhaoId,
        userId,
      );
      const ncId = rows[0].id;
      await this.prisma.$executeRawUnsafe(
        `UPDATE nao_conformidades SET numero = $1 WHERE id = $2`,
        `NC-CON-${obraId}-${ncId.toString().padStart(4, '0')}`,
        ncId,
      );
    } catch {
      // Tabela não existe ainda — grava em audit_log como fallback
      await this.prisma
        .$executeRawUnsafe(
          `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
           VALUES ($1, $2, 'NC_AUTOMATICA', 'caminhao_concreto', $3, NULL::jsonb, $4::jsonb)`,
          tenantId,
          userId,
          caminhaoId,
          JSON.stringify({ tipo, descricao, obraId }),
        )
        .catch((e: unknown) => this.logger.error(`NC fallback audit falhou: ${e}`));
    }
  }

  private auditLog(
    tenantId: number,
    userId: number,
    acao: string,
    entidadeId: number,
    antes: unknown,
    depois: unknown,
  ): Promise<unknown> {
    return this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
       VALUES ($1, $2, $3, 'caminhao_concreto', $4, $5::jsonb, $6::jsonb)`,
      tenantId,
      userId,
      acao,
      entidadeId,
      JSON.stringify(antes),
      JSON.stringify(depois),
    );
  }
}
