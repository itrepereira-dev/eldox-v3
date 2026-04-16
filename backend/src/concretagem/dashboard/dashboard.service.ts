// backend/src/concretagem/dashboard/dashboard.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardConcretagemKpis {
  volume_previsto_total: number;
  volume_realizado_total: number;
  concretagens_total: number;
  concretagens_concluidas: number;
  taxa_aprovacao_cps: number;    // %
  total_cps: number;
  cps_aprovados: number;
  cps_reprovados: number;
  cps_aguardando: number;
  cps_vencidos_sem_resultado: number;
  resistencia_media_28d: number; // MPa
  ncs_abertas: number;
  ranking_concreteiras: ConcreteiraRank[];
}

export interface ConcreteiraRank {
  fornecedor_id: number;
  total_caminhoes: number;
  volume_total: number;
  slump_medio: number | null;
  taxa_aprovacao_cps: number;
}

export interface DashboardFinanceiroKpis {
  cancelamentos_com_multa: number;
  total_cancelamentos: number;
  volume_contestado_m3: number;        // sobra_tipo = 'NAO_PAGAR' sum
  volume_descartado_m3: number;        // sobra_tipo = 'DESCARTADO' sum
  volume_aproveitado_m3: number;       // sobra_tipo = 'APROVEITADO' sum
  caminhoes_nao_descarregaram: number; // nao_descarregou = TRUE
  por_traco: TracoStats[];
  ranking_avancado: ConcreteiraRankAvancado[];
}

export interface TracoStats {
  traco: string;
  total_concretagens: number;
  volume_previsto: number;
  volume_realizado: number;
  resistencia_media_28d: number | null;
  taxa_aprovacao_cps: number;
}

export interface ConcreteiraRankAvancado {
  fornecedor_id: number;
  fornecedor_nome: string;
  total_caminhoes: number;
  volume_total: number;
  caminhoes_nao_descarregaram: number;
  volume_contestado: number;
  fator_ac_medio: number | null;
  flow_medio: number | null;
  taxa_aprovacao_cps: number;
  slump_medio: number | null;
}

@Injectable()
export class DashboardConcretagemService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(tenantId: number, obraId: number): Promise<DashboardConcretagemKpis> {
    // Valida obra
    const obraRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "Obra" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
      obraId,
      tenantId,
    );
    if (!obraRows.length) throw new NotFoundException('Obra não encontrada');

    // 1. Concretagens e volumes
    const concretagensRows = await this.prisma.$queryRawUnsafe<{
      total: number;
      concluidas: number;
      volume_previsto: number;
    }[]>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'CONCLUIDA'::"StatusConcretagem")::int AS concluidas,
         COALESCE(SUM(volume_previsto), 0)::float AS volume_previsto
       FROM concretagens
       WHERE tenant_id = $1 AND obra_id = $2 AND deleted_at IS NULL`,
      tenantId,
      obraId,
    );

    // Volume realizado = soma dos volumes dos caminhões concluídos
    const volumeRealizadoRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COALESCE(SUM(cc.volume), 0)::float AS total
       FROM caminhoes_concreto cc
       JOIN concretagens b ON b.id = cc.concretagem_id AND b.tenant_id = cc.tenant_id
       WHERE cc.tenant_id = $1 AND b.obra_id = $2
         AND cc.status IN ('CONCLUIDO'::"StatusCaminhao")`,
      tenantId,
      obraId,
    );

    // 2. CPs por status
    const cpsRows = await this.prisma.$queryRawUnsafe<{
      total: number;
      aprovados: number;
      reprovados: number;
      aguardando: number;
      vencidos_sem_resultado: number;
      resistencia_media_28d: number | null;
    }[]>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE cp.status = 'ROMPIDO_APROVADO'::"StatusCp")::int AS aprovados,
         COUNT(*) FILTER (WHERE cp.status = 'ROMPIDO_REPROVADO'::"StatusCp")::int AS reprovados,
         COUNT(*) FILTER (WHERE cp.status = 'AGUARDANDO_RUPTURA'::"StatusCp")::int AS aguardando,
         COUNT(*) FILTER (
           WHERE cp.status = 'AGUARDANDO_RUPTURA'::"StatusCp"
             AND cp.data_ruptura_prev < CURRENT_DATE
         )::int AS vencidos_sem_resultado,
         AVG(cp.resistencia) FILTER (
           WHERE cp.status = 'ROMPIDO_APROVADO'::"StatusCp" AND cp.idade_dias = 28
         )::float AS resistencia_media_28d
       FROM corpos_de_prova cp
       JOIN concretagens b ON b.id = cp.concretagem_id AND b.tenant_id = cp.tenant_id
       WHERE cp.tenant_id = $1 AND b.obra_id = $2`,
      tenantId,
      obraId,
    );

    // 3. NCs abertas de concretagem
    let ncsAbertas = 0;
    try {
      const ncsRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
        `SELECT COUNT(*)::int AS total FROM nao_conformidades
         WHERE tenant_id = $1 AND obra_id = $2
           AND categoria = 'CONCRETAGEM'::"NcCategoria"
           AND status NOT IN ('FECHADA'::"NcStatus",'CANCELADA'::"NcStatus")
           AND deleted_at IS NULL`,
        tenantId,
        obraId,
      );
      ncsAbertas = Number(ncsRows[0]?.total ?? 0);
    } catch {
      // Tabela NCs ainda não existe
      ncsAbertas = 0;
    }

    // 4. Ranking concreteiras
    const ranking = await this.getRankingConcreteiras(tenantId, obraId);

    const row = concretagensRows[0];
    const cpsRow = cpsRows[0];
    const totalCps = Number(cpsRow?.total ?? 0);
    const aprovados = Number(cpsRow?.aprovados ?? 0);
    const reprovados = Number(cpsRow?.reprovados ?? 0);
    const rompidos = aprovados + reprovados;
    const taxaAprovacao = rompidos > 0 ? Math.round((aprovados / rompidos) * 10000) / 100 : 0;

    return {
      volume_previsto_total:        Number(row?.volume_previsto ?? 0),
      volume_realizado_total:       Number(volumeRealizadoRows[0]?.total ?? 0),
      concretagens_total:           Number(row?.total ?? 0),
      concretagens_concluidas:      Number(row?.concluidas ?? 0),
      taxa_aprovacao_cps:           taxaAprovacao,
      total_cps:                    totalCps,
      cps_aprovados:                aprovados,
      cps_reprovados:               reprovados,
      cps_aguardando:               Number(cpsRow?.aguardando ?? 0),
      cps_vencidos_sem_resultado:   Number(cpsRow?.vencidos_sem_resultado ?? 0),
      resistencia_media_28d:        Number(cpsRow?.resistencia_media_28d ?? 0),
      ncs_abertas:                  ncsAbertas,
      ranking_concreteiras:         ranking,
    };
  }

  async getFinanceiro(tenantId: number, obraId: number): Promise<DashboardFinanceiroKpis> {
    const obraRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "Obra" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
      obraId, tenantId,
    );
    if (!obraRows.length) throw new NotFoundException('Obra não encontrada');

    // Cancelamentos com multa
    const cancelRows = await this.prisma.$queryRawUnsafe<{
      com_multa: number; total: number;
    }[]>(
      `SELECT
         COUNT(*) FILTER (WHERE cancelamento_multa = TRUE)::int AS com_multa,
         COUNT(*)::int AS total
       FROM concretagens
       WHERE tenant_id = $1 AND obra_id = $2 AND status = 'CANCELADA' AND deleted_at IS NULL`,
      tenantId, obraId,
    );

    // Sobras e não-descarregamentos
    const sobraRows = await this.prisma.$queryRawUnsafe<{
      contestado: number; descartado: number; aproveitado: number; nao_descarregou: number;
    }[]>(
      `SELECT
         COALESCE(SUM(sobra_volume) FILTER (WHERE sobra_tipo = 'NAO_PAGAR'),  0)::float AS contestado,
         COALESCE(SUM(sobra_volume) FILTER (WHERE sobra_tipo = 'DESCARTADO'), 0)::float AS descartado,
         COALESCE(SUM(sobra_volume) FILTER (WHERE sobra_tipo = 'APROVEITADO'),0)::float AS aproveitado,
         COUNT(*) FILTER (WHERE nao_descarregou = TRUE)::int AS nao_descarregou
       FROM caminhoes_concreto cc
       JOIN concretagens b ON b.id = cc.concretagem_id
       WHERE cc.tenant_id = $1 AND b.obra_id = $2 AND b.deleted_at IS NULL`,
      tenantId, obraId,
    );

    // Por traço
    const tracoRows = await this.prisma.$queryRawUnsafe<TracoStats[]>(
      `SELECT
         COALESCE(b.traco_especificado, 'Não especificado') AS traco,
         COUNT(DISTINCT b.id)::int AS total_concretagens,
         COALESCE(SUM(b.volume_previsto), 0)::float AS volume_previsto,
         COALESCE(SUM(cc_vol.vol), 0)::float AS volume_realizado,
         AVG(cp.resistencia) FILTER (WHERE cp.idade_dias = 28 AND cp.resistencia IS NOT NULL AND cp.resistencia > 0)::float AS resistencia_media_28d,
         COALESCE(
           COUNT(*) FILTER (WHERE cp.resistencia >= b.fck_especificado AND cp.resistencia IS NOT NULL)::float
           / NULLIF(COUNT(*) FILTER (WHERE cp.resistencia IS NOT NULL), 0) * 100,
           0
         )::float AS taxa_aprovacao_cps
       FROM concretagens b
       LEFT JOIN corpos_de_prova cp ON cp.concretagem_id = b.id AND cp.tenant_id = $1
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(volume), 0) AS vol FROM caminhoes_concreto WHERE concretagem_id = b.id AND tenant_id = $1 AND status = 'CONCLUIDO'
       ) cc_vol ON TRUE
       WHERE b.tenant_id = $1 AND b.obra_id = $2 AND b.deleted_at IS NULL
       GROUP BY COALESCE(b.traco_especificado, 'Não especificado')
       ORDER BY volume_previsto DESC`,
      tenantId, obraId,
    );

    // Ranking avançado por concreteira
    const rankRows = await this.prisma.$queryRawUnsafe<ConcreteiraRankAvancado[]>(
      `SELECT
         b.fornecedor_id,
         COALESCE(f.razao_social, 'Desconhecido') AS fornecedor_nome,
         COUNT(cc.id)::int AS total_caminhoes,
         COALESCE(SUM(cc.volume), 0)::float AS volume_total,
         COUNT(*) FILTER (WHERE cc.nao_descarregou = TRUE)::int AS caminhoes_nao_descarregaram,
         COALESCE(SUM(cc.sobra_volume) FILTER (WHERE cc.sobra_tipo = 'NAO_PAGAR'), 0)::float AS volume_contestado,
         AVG(cc.fator_ac) FILTER (WHERE cc.fator_ac IS NOT NULL)::float AS fator_ac_medio,
         AVG(cc.flow)     FILTER (WHERE cc.flow IS NOT NULL)::float AS flow_medio,
         AVG(cc.slump_medido) FILTER (WHERE cc.slump_medido IS NOT NULL)::float AS slump_medio,
         COALESCE(
           COUNT(cp.id) FILTER (WHERE cp.resistencia >= b.fck_especificado AND cp.resistencia IS NOT NULL)::float
           / NULLIF(COUNT(cp.id) FILTER (WHERE cp.resistencia IS NOT NULL), 0) * 100,
           0
         )::float AS taxa_aprovacao_cps
       FROM caminhoes_concreto cc
       JOIN concretagens b ON b.id = cc.concretagem_id
       LEFT JOIN corpos_de_prova cp ON cp.caminhao_id = cc.id AND cp.tenant_id = $1
       LEFT JOIN fvm_fornecedores f ON f.id = b.fornecedor_id AND f.tenant_id = $1
       WHERE cc.tenant_id = $1 AND b.obra_id = $2 AND b.deleted_at IS NULL
       GROUP BY b.fornecedor_id, f.razao_social
       ORDER BY total_caminhoes DESC`,
      tenantId, obraId,
    );

    return {
      cancelamentos_com_multa:   Number(cancelRows[0]?.com_multa  ?? 0),
      total_cancelamentos:       Number(cancelRows[0]?.total      ?? 0),
      volume_contestado_m3:      Number(sobraRows[0]?.contestado  ?? 0),
      volume_descartado_m3:      Number(sobraRows[0]?.descartado  ?? 0),
      volume_aproveitado_m3:     Number(sobraRows[0]?.aproveitado ?? 0),
      caminhoes_nao_descarregaram: Number(sobraRows[0]?.nao_descarregou ?? 0),
      por_traco:      tracoRows,
      ranking_avancado: rankRows,
    };
  }

  async getRankingConcreteiras(tenantId: number, obraId: number): Promise<ConcreteiraRank[]> {
    return this.prisma.$queryRawUnsafe<ConcreteiraRank[]>(
      `SELECT
         b.fornecedor_id,
         COUNT(cc.id)::int AS total_caminhoes,
         COALESCE(SUM(cc.volume), 0)::float AS volume_total,
         AVG(cc.slump_medido)::float AS slump_medio,
         ROUND(
           100.0 * COUNT(cp.id) FILTER (WHERE cp.status = 'ROMPIDO_APROVADO'::"StatusCp") /
           NULLIF(COUNT(cp.id) FILTER (WHERE cp.status IN ('ROMPIDO_APROVADO'::"StatusCp",'ROMPIDO_REPROVADO'::"StatusCp")), 0),
           2
         )::float AS taxa_aprovacao_cps
       FROM concretagens b
       JOIN caminhoes_concreto cc ON cc.concretagem_id = b.id AND cc.tenant_id = b.tenant_id
       LEFT JOIN corpos_de_prova cp ON cp.caminhao_id = cc.id AND cp.tenant_id = cc.tenant_id
       WHERE b.tenant_id = $1 AND b.obra_id = $2 AND b.deleted_at IS NULL
       GROUP BY b.fornecedor_id
       ORDER BY volume_total DESC`,
      tenantId,
      obraId,
    );
  }
}
