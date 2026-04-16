// backend/src/fvs/dashboard/fvs-graficos.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardGraficosQueryDto } from './dto/dashboard-graficos-query.dto';

// ── Response shape interfaces ────────────────────────────────────────────────

export interface EvolucaoTemporalSerie {
  servico_id: number;
  servico_nome: string;
  cor: string;
  valores: (number | null)[];
}

export interface EvolucaoTemporalResult {
  labels: string[];
  series: EvolucaoTemporalSerie[];
}

export interface ConformidadePorServicoItem {
  servico_id: number;
  servico_nome: string;
  total_inspecoes: number;
  taxa_conformidade: number;
  ncs_abertas: number;
  tendencia: 'subindo' | 'caindo' | 'estavel';
}

export interface HeatmapCelula {
  servico_idx: number;
  periodo_idx: number;
  taxa: number | null;
  total_inspecoes: number;
}

export interface HeatmapResult {
  servicos: string[];
  periodos: string[];
  celulas: HeatmapCelula[];
}

export interface FunilResult {
  total_fichas: number;
  concluidas: number;
  aprovadas: number;
  com_nc: number;
  com_pa: number;
}

export interface DashboardGraficosResult {
  evolucao_temporal: EvolucaoTemporalResult;
  conformidade_por_servico: ConformidadePorServicoItem[];
  heatmap: HeatmapResult;
  funil: FunilResult;
}

// ── Deterministic hex colour from numeric id ─────────────────────────────────

function idToHex(id: number): string {
  const palette = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  ];
  return palette[id % palette.length];
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FvsGraficosService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardGraficos(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ): Promise<DashboardGraficosResult> {
    const [evolucaoRaw, conformidadeRaw, heatmapRaw, funilRaw] = await Promise.all([
      this._queryEvolucao(tenantId, obraId, dto),
      this._queryConformidade(tenantId, obraId, dto),
      this._queryHeatmap(tenantId, obraId, dto),
      this._queryFunil(tenantId, obraId, dto),
    ]);

    return {
      evolucao_temporal: this._transformEvolucao(evolucaoRaw, dto),
      conformidade_por_servico: this._transformConformidade(conformidadeRaw),
      heatmap: this._transformHeatmap(heatmapRaw, dto),
      funil: funilRaw[0] ?? { total_fichas: 0, concluidas: 0, aprovadas: 0, com_nc: 0, com_pa: 0 },
    };
  }

  // ── Evolução temporal raw query ─────────────────────────────────────────────

  private async _queryEvolucao(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ) {
    const trunc = dto.granularidade === 'mes' ? 'month' : 'week';
    const servicoFilter =
      dto.servico_ids && dto.servico_ids.length > 0
        ? `AND r.servico_id = ANY(ARRAY[${dto.servico_ids.join(',')}]::int[])`
        : '';

    return this.prisma.$queryRawUnsafe<
      Array<{
        periodo: Date;
        servico_id: number;
        servico_nome: string;
        taxa_conformidade: number | null;
      }>
    >(
      `SELECT
         DATE_TRUNC('${trunc}', r.inspecionado_em) AS periodo,
         cs.id AS servico_id,
         cs.nome AS servico_nome,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) /
           NULLIF(COUNT(*) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')), 0),
           1
         ) AS taxa_conformidade
       FROM fvs_registros r
       JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
       JOIN fvs_fichas f ON f.id = r.ficha_id
       WHERE f.obra_id = $1
         AND r.tenant_id = $2
         AND r.inspecionado_em BETWEEN $3::date AND $4::date + INTERVAL '1 day'
         AND r.inspecionado_em IS NOT NULL
         ${servicoFilter}
       GROUP BY DATE_TRUNC('${trunc}', r.inspecionado_em), cs.id, cs.nome
       ORDER BY periodo, cs.nome`,
      obraId,
      tenantId,
      dto.data_inicio,
      dto.data_fim,
    );
  }

  private _transformEvolucao(
    rows: Array<{ periodo: Date; servico_id: number; servico_nome: string; taxa_conformidade: number | null }>,
    dto: DashboardGraficosQueryDto,
  ): EvolucaoTemporalResult {
    if (rows.length === 0) return { labels: [], series: [] };

    // Build sorted unique label list
    const labelSet = new Map<string, string>(); // isoKey -> display label
    for (const row of rows) {
      const d = new Date(row.periodo);
      const isoKey = d.toISOString().slice(0, 10);
      const display =
        dto.granularidade === 'mes'
          ? d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
          : `Sem ${Math.ceil(d.getDate() / 7)} — ${d.toLocaleDateString('pt-BR', { month: 'short' })}`;
      labelSet.set(isoKey, display);
    }
    const sortedKeys = Array.from(labelSet.keys()).sort();
    const labels = sortedKeys.map((k) => labelSet.get(k)!);

    // Build per-service map
    const serviceMap = new Map<number, { nome: string; values: Map<string, number | null> }>();
    for (const row of rows) {
      const isoKey = new Date(row.periodo).toISOString().slice(0, 10);
      if (!serviceMap.has(row.servico_id)) {
        serviceMap.set(row.servico_id, { nome: row.servico_nome, values: new Map() });
      }
      serviceMap.get(row.servico_id)!.values.set(isoKey, row.taxa_conformidade);
    }

    const series: EvolucaoTemporalSerie[] = Array.from(serviceMap.entries()).map(([id, s]) => ({
      servico_id: id,
      servico_nome: s.nome,
      cor: idToHex(id),
      valores: sortedKeys.map((k) => s.values.get(k) ?? null),
    }));

    return { labels, series };
  }

  // ── Conformidade por serviço ────────────────────────────────────────────────

  private async _queryConformidade(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ) {
    const servicoFilter =
      dto.servico_ids && dto.servico_ids.length > 0
        ? `AND r.servico_id = ANY(ARRAY[${dto.servico_ids.join(',')}]::int[])`
        : '';

    // Split time range in half to compute tendency
    return this.prisma.$queryRawUnsafe<
      Array<{
        servico_id: number;
        servico_nome: string;
        total_inspecoes: number;
        taxa_conformidade: number;
        ncs_abertas: number;
        taxa_primeira_metade: number | null;
        taxa_segunda_metade: number | null;
      }>
    >(
      `WITH periodo AS (
         SELECT
           $3::date AS inicio,
           $4::date AS fim,
           ($3::date + ($4::date - $3::date) / 2) AS meio
       ),
       base AS (
         SELECT
           cs.id AS servico_id,
           cs.nome AS servico_nome,
           COUNT(r.id) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel'))::int AS total_inspecoes,
           ROUND(
             100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) /
             NULLIF(COUNT(r.id) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')), 0), 1
           ) AS taxa_conformidade,
           ROUND(
             100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')
               AND r.inspecionado_em < (SELECT meio FROM periodo)) /
             NULLIF(COUNT(r.id) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')
               AND r.inspecionado_em < (SELECT meio FROM periodo)), 0), 1
           ) AS taxa_primeira_metade,
           ROUND(
             100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')
               AND r.inspecionado_em >= (SELECT meio FROM periodo)) /
             NULLIF(COUNT(r.id) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')
               AND r.inspecionado_em >= (SELECT meio FROM periodo)), 0), 1
           ) AS taxa_segunda_metade
         FROM fvs_registros r
         JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1
           AND r.tenant_id = $2
           AND r.inspecionado_em BETWEEN (SELECT inicio FROM periodo) AND (SELECT fim FROM periodo) + INTERVAL '1 day'
           AND r.inspecionado_em IS NOT NULL
           ${servicoFilter}
         GROUP BY cs.id, cs.nome
       ),
       ncs AS (
         SELECT r.servico_id, COUNT(nc.id)::int AS ncs_abertas
         FROM fvs_nao_conformidades nc
         JOIN fvs_registros r ON r.id = nc.registro_id
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1 AND nc.tenant_id = $2 AND nc.status = 'aberta'
         GROUP BY r.servico_id
       )
       SELECT b.*, COALESCE(n.ncs_abertas, 0) AS ncs_abertas
       FROM base b
       LEFT JOIN ncs n ON n.servico_id = b.servico_id
       WHERE b.total_inspecoes > 0
       ORDER BY b.taxa_conformidade ASC`,
      obraId,
      tenantId,
      dto.data_inicio,
      dto.data_fim,
    );
  }

  private _transformConformidade(
    rows: Array<{
      servico_id: number;
      servico_nome: string;
      total_inspecoes: number;
      taxa_conformidade: number;
      ncs_abertas: number;
      taxa_primeira_metade: number | null;
      taxa_segunda_metade: number | null;
    }>,
  ): ConformidadePorServicoItem[] {
    return rows.map((r) => {
      let tendencia: 'subindo' | 'caindo' | 'estavel' = 'estavel';
      if (r.taxa_primeira_metade !== null && r.taxa_segunda_metade !== null) {
        const delta = r.taxa_segunda_metade - r.taxa_primeira_metade;
        if (delta > 3) tendencia = 'subindo';
        else if (delta < -3) tendencia = 'caindo';
      }
      return {
        servico_id: Number(r.servico_id),
        servico_nome: r.servico_nome,
        total_inspecoes: Number(r.total_inspecoes),
        taxa_conformidade: Number(r.taxa_conformidade),
        ncs_abertas: Number(r.ncs_abertas),
        tendencia,
      };
    });
  }

  // ── Heatmap ─────────────────────────────────────────────────────────────────

  private async _queryHeatmap(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ) {
    const trunc = dto.granularidade === 'mes' ? 'month' : 'week';
    const servicoFilter =
      dto.servico_ids && dto.servico_ids.length > 0
        ? `AND r.servico_id = ANY(ARRAY[${dto.servico_ids.join(',')}]::int[])`
        : '';

    return this.prisma.$queryRawUnsafe<
      Array<{
        servico_id: number;
        servico_nome: string;
        periodo: Date;
        taxa: number | null;
        total_inspecoes: number;
      }>
    >(
      `SELECT
         cs.id AS servico_id,
         cs.nome AS servico_nome,
         DATE_TRUNC('${trunc}', r.inspecionado_em) AS periodo,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) /
           NULLIF(COUNT(*) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')), 0),
           1
         ) AS taxa,
         COUNT(*) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel'))::int AS total_inspecoes
       FROM fvs_registros r
       JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
       JOIN fvs_fichas f ON f.id = r.ficha_id
       WHERE f.obra_id = $1
         AND r.tenant_id = $2
         AND r.inspecionado_em BETWEEN $3::date AND $4::date + INTERVAL '1 day'
         AND r.inspecionado_em IS NOT NULL
         ${servicoFilter}
       GROUP BY cs.id, cs.nome, DATE_TRUNC('${trunc}', r.inspecionado_em)
       ORDER BY cs.nome, periodo`,
      obraId,
      tenantId,
      dto.data_inicio,
      dto.data_fim,
    );
  }

  private _transformHeatmap(
    rows: Array<{ servico_id: number; servico_nome: string; periodo: Date; taxa: number | null; total_inspecoes: number }>,
    dto: DashboardGraficosQueryDto,
  ): HeatmapResult {
    if (rows.length === 0) return { servicos: [], periodos: [], celulas: [] };

    const servicoNames: string[] = [];
    const servicoIdx = new Map<number, number>();
    const periodoKeys: string[] = [];
    const periodoIdx = new Map<string, number>();

    for (const row of rows) {
      if (!servicoIdx.has(row.servico_id)) {
        servicoIdx.set(row.servico_id, servicoNames.length);
        servicoNames.push(row.servico_nome);
      }
      const isoKey = new Date(row.periodo).toISOString().slice(0, 10);
      if (!periodoIdx.has(isoKey)) {
        periodoIdx.set(isoKey, periodoKeys.length);
        periodoKeys.push(isoKey);
      }
    }

    periodoKeys.sort();
    // Re-index after sort
    periodoKeys.forEach((k, i) => periodoIdx.set(k, i));

    const periodoLabels = periodoKeys.map((k) => {
      const d = new Date(k);
      return dto.granularidade === 'mes'
        ? d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        : `Sem ${Math.ceil(d.getDate() / 7)}/${d.toLocaleDateString('pt-BR', { month: 'short' })}`;
    });

    const celulas: HeatmapCelula[] = rows.map((row) => ({
      servico_idx: servicoIdx.get(row.servico_id)!,
      periodo_idx: periodoIdx.get(new Date(row.periodo).toISOString().slice(0, 10))!,
      taxa: row.taxa !== null ? Number(row.taxa) : null,
      total_inspecoes: Number(row.total_inspecoes),
    }));

    return { servicos: servicoNames, periodos: periodoLabels, celulas };
  }

  // ── Funil ───────────────────────────────────────────────────────────────────

  private async _queryFunil(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ) {
    return this.prisma.$queryRawUnsafe<Array<FunilResult>>(
      `SELECT
         COUNT(DISTINCT f.id)::int                                                AS total_fichas,
         COUNT(DISTINCT f.id) FILTER (WHERE f.concluida_em IS NOT NULL)::int      AS concluidas,
         COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'aprovada')::int           AS aprovadas,
         COUNT(DISTINCT f.id) FILTER (WHERE EXISTS (
           SELECT 1 FROM fvs_nao_conformidades nc
           JOIN fvs_registros r2 ON r2.id = nc.registro_id
           WHERE r2.ficha_id = f.id AND nc.deleted_at IS NULL
         ))::int                                                                   AS com_nc,
         COUNT(DISTINCT f.id) FILTER (WHERE EXISTS (
           SELECT 1 FROM pa_plano_acao pa
           WHERE pa.origem_id = f.id AND pa.origem_tipo = 'INSPECAO_FVS' AND pa.deleted_at IS NULL
         ))::int                                                                   AS com_pa
       FROM fvs_fichas f
       WHERE f.obra_id = $1
         AND f.tenant_id = $2
         AND f.created_at BETWEEN $3::date AND $4::date + INTERVAL '1 day'
         AND f.deleted_at IS NULL`,
      obraId,
      tenantId,
      dto.data_inicio,
      dto.data_fim,
    );
  }
}
