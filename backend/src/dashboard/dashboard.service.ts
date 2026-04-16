import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveLayoutDto } from './dto/save-layout.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLayout(usuarioId: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { dashboardLayout: true },
    });
    return { layout: user?.dashboardLayout ?? null };
  }

  async saveLayout(usuarioId: number, dto: SaveLayoutDto) {
    const user = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { dashboardLayout: dto.layout as any },
      select: { dashboardLayout: true },
    });
    return { layout: user.dashboardLayout };
  }

  async getSummary(tenantId: number, usuarioId: number) {
    const [obras, ncs, aprovacoes, gedVencendo] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'EM_EXECUCAO')::int AS em_execucao,
          COUNT(*) FILTER (WHERE status = 'PARALISADA')::int  AS paralisadas,
          COUNT(*) FILTER (WHERE status = 'CONCLUIDA')::int   AS concluidas
        FROM "Obra"
        WHERE "tenantId" = $1 AND "deletadoEm" IS NULL
      `, tenantId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('FECHADA','CANCELADA'))::int         AS abertas,
          COUNT(*) FILTER (WHERE criticidade = 'ALTA' AND status NOT IN ('FECHADA','CANCELADA'))::int AS criticas,
          COUNT(*) FILTER (WHERE prazo < NOW() AND status NOT IN ('FECHADA','CANCELADA'))::int         AS vencidas
        FROM "NaoConformidade"
        WHERE tenant_id = $1 AND deleted_at IS NULL
      `, tenantId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*)::int AS pendentes
        FROM "AprovacaoInstancia"
        WHERE "tenantId" = $1
          AND status = 'PENDENTE'
          AND "aprovadorId" = $2
      `, tenantId, usuarioId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*)::int AS vencendo_30d
        FROM "GedVersao" gv
        JOIN "GedDocumento" gd ON gd.id = gv."documentoId"
        WHERE gd."tenantId" = $1
          AND gv.status NOT IN ('OBSOLETO','CANCELADO','REJEITADO')
          AND gv."validadeAte" BETWEEN NOW() AND NOW() + INTERVAL '30 days'
      `, tenantId),
    ]);

    return {
      obras: obras[0],
      ncs: ncs[0],
      aprovacoes: { pendentes_do_usuario: aprovacoes[0]?.pendentes ?? 0 },
      ged: { vencendo_30d: gedVencendo[0]?.vencendo_30d ?? 0 },
    };
  }

  async getFeed(tenantId: number, limit = 20) {
    const items = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT tipo, titulo, subtitulo, obra_nome, created_at, link, cor
      FROM (
        SELECT
          'nc_aberta'   AS tipo,
          'NC aberta: ' || titulo AS titulo,
          'Criticidade ' || criticidade AS subtitulo,
          (SELECT nome FROM "Obra" WHERE id = nc.obra_id) AS obra_nome,
          nc.created_at,
          '/ncs' AS link,
          'red' AS cor
        FROM "NaoConformidade" nc
        WHERE nc.tenant_id = $1 AND nc.deleted_at IS NULL
          AND nc.status NOT IN ('FECHADA','CANCELADA')

        UNION ALL

        SELECT
          'aprovacao_pendente' AS tipo,
          'Aprovação pendente: ' || modulo AS titulo,
          NULL AS subtitulo,
          NULL AS obra_nome,
          ai."criadoEm" AS created_at,
          '/aprovacoes' AS link,
          'yellow' AS cor
        FROM "AprovacaoInstancia" ai
        WHERE ai."tenantId" = $1 AND ai.status = 'PENDENTE'
      ) t
      ORDER BY created_at DESC
      LIMIT $2
    `, tenantId, limit);

    return { items };
  }
}
