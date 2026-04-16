// backend/src/concretagem/alertas/alertas-cp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertasCpService {
  private readonly logger = new Logger(AlertasCpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica CPs com data_ruptura_prev <= NOW() + 2 dias e alerta_enviado = false.
   * Grava em concretagem_alertas_log e marca alerta_enviado = true.
   */
  async verificarRupturasCps(): Promise<void> {
    this.logger.log('Iniciando verificação de CPs com ruptura próxima...');

    const cps = await this.prisma.$queryRawUnsafe<{
      id: number;
      tenant_id: number;
      numero: string;
      idade_dias: number;
      data_ruptura_prev: Date;
      betonada_numero: string;
      elemento_estrutural: string;
      obra_id: number;
    }[]>(
      `SELECT cp.id, cp.tenant_id, cp.numero, cp.idade_dias, cp.data_ruptura_prev,
              b.numero AS betonada_numero, b.elemento_estrutural, b.obra_id
       FROM corpos_de_prova cp
       JOIN concretagens b ON b.id = cp.concretagem_id AND b.tenant_id = cp.tenant_id
       WHERE cp.status = 'AGUARDANDO_RUPTURA'::"StatusCp"
         AND cp.alerta_enviado = FALSE
         AND cp.data_ruptura_prev <= NOW() + INTERVAL '2 days'
         AND b.deleted_at IS NULL
       ORDER BY cp.data_ruptura_prev ASC`,
    );

    this.logger.log(`${cps.length} CPs para alertar`);

    for (const cp of cps) {
      // Marcar ANTES do envio (at-least-once)
      await this.prisma
        .$executeRawUnsafe(
          `UPDATE corpos_de_prova SET alerta_enviado = TRUE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          cp.id,
          cp.tenant_id,
        )
        .catch((e: unknown) =>
          this.logger.error(`Falha ao marcar alerta CP ${cp.id}: ${e}`),
        );

      const dataFmt = new Date(cp.data_ruptura_prev).toLocaleDateString('pt-BR');
      const vencido = new Date(cp.data_ruptura_prev) < new Date();
      const descricao = vencido
        ? `CP ${cp.numero} (${cp.idade_dias}d) da betonada ${cp.betonada_numero} VENCIDO em ${dataFmt}`
        : `CP ${cp.numero} (${cp.idade_dias}d) da betonada ${cp.betonada_numero} vence em ${dataFmt}`;

      // Busca destinatário (engenheiro da obra)
      const engRows = await this.prisma.$queryRawUnsafe<{ whatsapp: string; nome: string }[]>(
        `SELECT u.whatsapp, u.nome
         FROM "UsuarioObra" uo
         JOIN "Usuario" u ON u.id = uo."usuarioId" AND u."tenantId" = $2
         WHERE uo."obraId" = $1 AND u.role = 'ENGENHEIRO' AND u.ativo = true
           AND u.whatsapp IS NOT NULL
         LIMIT 1`,
        cp.obra_id,
        cp.tenant_id,
      );
      const destinatario = engRows[0]?.whatsapp ?? 'N/A';

      // Grava log (fire-and-forget)
      void this.prisma
        .$executeRawUnsafe(
          `INSERT INTO concretagem_alertas_log (tenant_id, cp_id, tipo, destinatario, status)
           VALUES ($1, $2, $3, $4, 'ENVIADO')`,
          cp.tenant_id,
          cp.id,
          vencido ? 'RUPTURA_VENCIDA' : 'RUPTURA_PROXIMA',
          destinatario,
        )
        .catch((e: unknown) =>
          this.logger.error(`Falha ao gravar alerta log CP ${cp.id}: ${e}`),
        );

      this.logger.log(`Alerta CP ${cp.id}: ${descricao} → ${destinatario}`);
    }

    this.logger.log('Verificação de rupturas CPs concluída');
  }
}
