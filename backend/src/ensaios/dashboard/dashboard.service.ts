// backend/src/ensaios/dashboard/dashboard.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardMateriaisDto {
  taxa_conformidade: number;       // 0–100, 2 casas decimais
  total_ensaios_revisados: number;
  laudos_pendentes: number;
  lotes_em_quarentena: number;
  proximos_cupons_7d: number;      // proximo_ensaio_data dentro de 7 dias (não alertado ou vencido)
  ensaios_vencidos: number;        // proximo_ensaio_data < now
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMateriaisKpis(
    tenantId: number,
    obraId: number,
  ): Promise<DashboardMateriaisDto> {
    // Valida que a obra pertence ao tenant
    const obraRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "Obra" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
      obraId, tenantId,
    );
    if (!obraRows.length) throw new NotFoundException('Obra não encontrada');

    // 1. Taxa de conformidade + total revisados (APROVADO + REPROVADO)
    const conformRows = await this.prisma.$queryRawUnsafe<{
      aprovados: number; reprovados: number;
    }[]>(
      `SELECT
         COUNT(*) FILTER (WHERE r.situacao = 'APROVADO')  AS aprovados,
         COUNT(*) FILTER (WHERE r.situacao = 'REPROVADO') AS reprovados
       FROM ensaio_revisao r
       JOIN ensaio_laboratorial e ON e.id = r.ensaio_id AND e.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1 AND e.obra_id = $2
         AND r.situacao IN ('APROVADO', 'REPROVADO')`,
      tenantId, obraId,
    );
    const aprovados  = Number(conformRows[0]?.aprovados  ?? 0);
    const reprovados = Number(conformRows[0]?.reprovados ?? 0);
    const totalRevisados = aprovados + reprovados;
    const taxaConformidade = totalRevisados > 0
      ? Math.round((aprovados / totalRevisados) * 10000) / 100
      : 0;

    // 2. Laudos pendentes
    const pendentesRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total
       FROM ensaio_revisao r
       JOIN ensaio_laboratorial e ON e.id = r.ensaio_id AND e.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1 AND e.obra_id = $2 AND r.situacao = 'PENDENTE'`,
      tenantId, obraId,
    );
    const laudosPendentes = Number(pendentesRows[0]?.total ?? 0);

    // 3. Lotes em quarentena
    const quarentenaRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(DISTINCT fl.id)::int AS total
       FROM fvm_lotes fl
       JOIN ensaio_laboratorial e ON e.fvm_lote_id = fl.id AND e.tenant_id = fl.tenant_id
       WHERE fl.tenant_id = $1 AND e.obra_id = $2 AND fl.status = 'quarentena'`,
      tenantId, obraId,
    );
    const lotesEmQuarentena = Number(quarentenaRows[0]?.total ?? 0);

    // 4. Próximos cupons (7 dias) e vencidos
    const cuponsRows = await this.prisma.$queryRawUnsafe<{
      proximos_7d: number; vencidos: number;
    }[]>(
      `SELECT
         COUNT(*) FILTER (
           WHERE e.proximo_ensaio_data BETWEEN NOW() AND NOW() + INTERVAL '7 days'
         )::int AS proximos_7d,
         COUNT(*) FILTER (
           WHERE e.proximo_ensaio_data < NOW()
         )::int AS vencidos
       FROM ensaio_laboratorial e
       WHERE e.tenant_id = $1 AND e.obra_id = $2
         AND e.proximo_ensaio_data IS NOT NULL`,
      tenantId, obraId,
    );
    const proximosCupons7d = Number(cuponsRows[0]?.proximos_7d ?? 0);
    const ensaiosVencidos  = Number(cuponsRows[0]?.vencidos    ?? 0);

    return {
      taxa_conformidade:      taxaConformidade,
      total_ensaios_revisados: totalRevisados,
      laudos_pendentes:       laudosPendentes,
      lotes_em_quarentena:    lotesEmQuarentena,
      proximos_cupons_7d:     proximosCupons7d,
      ensaios_vencidos:       ensaiosVencidos,
    };
  }
}
