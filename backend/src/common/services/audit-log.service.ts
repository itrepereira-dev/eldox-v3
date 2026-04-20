import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogEntry {
  tenantId: number;
  usuarioId?: number | null;
  acao: string;
  entidade: string;
  entidadeId?: number | null;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  detalhes?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * AuditLogService — wrapper centralizado do INSERT em audit_log.
 *
 * Spec: migration 20260417000000_audit_log_core (append-only, triggers bloqueiam
 * UPDATE/DELETE fora de SUPERUSER).
 *
 * Compliance: PBQP-H SiAC, ISO 9001:2015 §7.5, LGPD Art. 37.
 *
 * Uso:
 *   await audit.log({ tenantId, usuarioId, acao: 'CREATE', entidade: 'usuario', ... });
 *
 * Nunca lança — falhas de auditoria são logadas como erro mas não afetam o
 * fluxo principal (requisição HTTP do usuário não deve falhar porque o
 * audit_log ficou indisponível).
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger('AuditLog');

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO audit_log
          (tenant_id, usuario_id, acao, entidade, entidade_id,
           dados_antes, dados_depois, detalhes, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)`,
        entry.tenantId,
        entry.usuarioId ?? null,
        entry.acao,
        entry.entidade,
        entry.entidadeId ?? null,
        entry.dadosAntes !== undefined ? JSON.stringify(entry.dadosAntes) : null,
        entry.dadosDepois !== undefined
          ? JSON.stringify(entry.dadosDepois)
          : null,
        entry.detalhes !== undefined ? JSON.stringify(entry.detalhes) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
      );
    } catch (err) {
      this.logger.error(
        `audit_log falhou entidade=${entry.entidade} acao=${entry.acao}: ${(err as Error).message}`,
      );
    }
  }
}

@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
