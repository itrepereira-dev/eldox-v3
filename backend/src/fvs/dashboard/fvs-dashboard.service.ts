// backend/src/fvs/dashboard/fvs-dashboard.service.ts
// BI dashboard de qualidade FVS: taxas, top NCs, evolução temporal, SLA
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FvsDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Visão geral da obra ────────────────────────────────────────────────────

  async getResumoObra(tenantId: number, obraId: number) {
    const [fichas, registros, ncs, sla] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ status: string; total: number }>>(
        `SELECT status, COUNT(*)::int AS total
         FROM fvs_fichas WHERE obra_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         GROUP BY status`,
        obraId, tenantId,
      ),
      this.prisma.$queryRawUnsafe<Array<{ status: string; total: number }>>(
        `SELECT r.status, COUNT(r.id)::int AS total
         FROM fvs_registros r
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1 AND r.tenant_id = $2
         GROUP BY r.status`,
        obraId, tenantId,
      ),
      this.prisma.$queryRawUnsafe<Array<{ criticidade: string; status: string; total: number }>>(
        `SELECT nc.criticidade, nc.status, COUNT(nc.id)::int AS total
         FROM fvs_nao_conformidades nc
         JOIN fvs_registros r ON r.id = nc.registro_id
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1 AND nc.tenant_id = $2
         GROUP BY nc.criticidade, nc.status`,
        obraId, tenantId,
      ),
      this.prisma.$queryRawUnsafe<Array<{ vencidas: number; no_prazo: number; sem_prazo: number }>>(
        `SELECT
           COUNT(*) FILTER (WHERE nc.prazo_resolucao < NOW() AND nc.status = 'aberta')::int AS vencidas,
           COUNT(*) FILTER (WHERE nc.prazo_resolucao >= NOW() AND nc.status = 'aberta')::int AS no_prazo,
           COUNT(*) FILTER (WHERE nc.prazo_resolucao IS NULL AND nc.status = 'aberta')::int AS sem_prazo
         FROM fvs_nao_conformidades nc
         JOIN fvs_registros r ON r.id = nc.registro_id
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1 AND nc.tenant_id = $2`,
        obraId, tenantId,
      ),
    ]);

    const totalRegistros = registros.reduce((s, r) => s + r.total, 0);
    const conformes = registros
      .filter(r => ['conforme','conforme_apos_reinspecao','liberado_com_concessao'].includes(r.status))
      .reduce((s, r) => s + r.total, 0);
    const taxaConformidade = totalRegistros > 0 ? Math.round((conformes / totalRegistros) * 100) : null;

    return { fichas, registros, ncs, sla: sla[0] ?? { vencidas: 0, no_prazo: 0, sem_prazo: 0 }, taxaConformidade };
  }

  // ─── Taxa de conformidade por serviço ───────────────────────────────────────

  async getTaxaPorServico(tenantId: number, obraId: number) {
    return this.prisma.$queryRawUnsafe<Array<{
      servico_id: number; servico_nome: string;
      total: number; conformes: number; nao_conformes: number; taxa: number;
    }>>(
      `SELECT
         cs.id AS servico_id,
         cs.nome AS servico_nome,
         COUNT(r.id)::int AS total,
         COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao'))::int AS conformes,
         COUNT(r.id) FILTER (WHERE r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho'))::int AS nao_conformes,
         CASE WHEN COUNT(r.id) > 0
              THEN ROUND(COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao'))::numeric
                   / COUNT(r.id) * 100, 1)
              ELSE 0
         END AS taxa
       FROM fvs_registros r
       JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
       JOIN fvs_fichas f ON f.id = r.ficha_id
       WHERE f.obra_id = $1 AND r.tenant_id = $2
       GROUP BY cs.id, cs.nome
       ORDER BY taxa ASC
       LIMIT 20`,
      obraId, tenantId,
    );
  }

  // ─── Evolução temporal (últimos 30 dias) ────────────────────────────────────

  async getEvolucaoTemporal(tenantId: number, obraId: number, dias = 30) {
    return this.prisma.$queryRawUnsafe<Array<{
      data: string; conformes: number; nao_conformes: number; taxa: number;
    }>>(
      `SELECT
         DATE(r.inspecionado_em)::text AS data,
         COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao'))::int AS conformes,
         COUNT(*) FILTER (WHERE r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho'))::int AS nao_conformes,
         CASE WHEN COUNT(*) > 0
              THEN ROUND(COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao'))::numeric
                   / COUNT(*) * 100, 1)
              ELSE 0
         END AS taxa
       FROM fvs_registros r
       JOIN fvs_fichas f ON f.id = r.ficha_id
       WHERE f.obra_id = $1 AND r.tenant_id = $2
         AND r.inspecionado_em >= NOW() - ($3 || ' days')::interval
         AND r.inspecionado_em IS NOT NULL
       GROUP BY DATE(r.inspecionado_em)
       ORDER BY data ASC`,
      obraId, tenantId, String(dias),
    );
  }

  // ─── Top NCs por serviço (Pareto) ───────────────────────────────────────────

  async getTopNcs(tenantId: number, obraId: number, limit = 10) {
    return this.prisma.$queryRawUnsafe<Array<{
      servico_nome: string; item_nome: string; criticidade: string;
      total: number; abertas: number;
    }>>(
      `SELECT
         cs.nome AS servico_nome,
         ci.descricao AS item_nome,
         nc.criticidade,
         COUNT(nc.id)::int AS total,
         COUNT(nc.id) FILTER (WHERE nc.status = 'aberta')::int AS abertas
       FROM fvs_nao_conformidades nc
       JOIN fvs_registros r ON r.id = nc.registro_id
       JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
       LEFT JOIN fvs_catalogo_itens ci ON ci.id = r.item_id
       JOIN fvs_fichas f ON f.id = r.ficha_id
       WHERE f.obra_id = $1 AND nc.tenant_id = $2
       GROUP BY cs.nome, ci.descricao, nc.criticidade
       ORDER BY total DESC
       LIMIT $3`,
      obraId, tenantId, limit,
    );
  }

  // ─── Resumo global (todas as obras do tenant) ───────────────────────────────

  async getResumoGlobal(tenantId: number) {
    return this.prisma.$queryRawUnsafe<Array<{
      obra_id: number; obra_nome: string; fichas_total: number;
      taxa_conformidade: number | null; ncs_abertas: number; risco_score: number | null;
    }>>(
      `SELECT
         o.id AS obra_id,
         o.nome AS obra_nome,
         COUNT(DISTINCT f.id)::int AS fichas_total,
         ROUND(AVG(f.risco_score), 0) AS risco_score,
         COUNT(DISTINCT nc.id) FILTER (WHERE nc.status = 'aberta')::int AS ncs_abertas,
         CASE WHEN COUNT(r.id) > 0
              THEN ROUND(COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao'))::numeric
                   / COUNT(r.id) * 100, 1)
              ELSE NULL
         END AS taxa_conformidade
       FROM "Obra" o
       LEFT JOIN fvs_fichas f ON f.obra_id = o.id AND f.tenant_id = $1
       LEFT JOIN fvs_registros r ON r.ficha_id = f.id AND r.tenant_id = $1
       LEFT JOIN fvs_nao_conformidades nc ON nc.registro_id = r.id AND nc.tenant_id = $1
       WHERE o."tenantId" = $1 AND o."deletadoEm" IS NULL
       GROUP BY o.id, o.nome
       ORDER BY ncs_abertas DESC, taxa_conformidade ASC NULLS LAST`,
      tenantId,
    );
  }
}
