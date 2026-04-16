// backend/src/concretagem/laudos/laudos.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLaudoDto } from './dto/create-laudo.dto';

@Injectable()
export class LaudosService {
  private readonly logger = new Logger(LaudosService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Criar laudo ───────────────────────────────────────────────────────────

  async criar(tenantId: number, userId: number, dto: CreateLaudoDto) {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO laudos_laboratorio
         (tenant_id, concretagem_id, numero, tipo, data_emissao,
          laboratorio_nome, laboratorio_id, arquivo_url, ged_documento_id,
          resultado, observacoes, criado_por, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       RETURNING id`,
      tenantId,
      dto.concretagem_id,
      dto.numero,
      dto.tipo ?? null,
      dto.data_emissao,
      dto.laboratorio_nome ?? null,
      dto.laboratorio_id ?? null,
      dto.arquivo_url ?? null,
      dto.ged_documento_id ?? null,
      dto.resultado ?? 'PENDENTE',
      dto.observacoes ?? null,
      userId,
    );

    this.auditLog(tenantId, userId, 'CREATE', rows[0].id, null, dto).catch(
      (e: unknown) => this.logger.error(`auditLog laudo falhou: ${e}`),
    );

    return this.buscar(tenantId, rows[0].id);
  }

  // ── Listar por betonada ───────────────────────────────────────────────────

  async listarPorBetonada(tenantId: number, betonadaId: number) {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, tenant_id, concretagem_id, numero, tipo, data_emissao,
              laboratorio_nome, laboratorio_id, arquivo_url, ged_documento_id,
              resultado, observacoes, aprovado_por, aprovado_em,
              criado_por, created_at, updated_at
       FROM laudos_laboratorio
       WHERE tenant_id = $1 AND concretagem_id = $2
       ORDER BY data_emissao DESC, created_at DESC`,
      tenantId,
      betonadaId,
    );

    return rows;
  }

  // ── Buscar laudo ──────────────────────────────────────────────────────────

  async buscar(tenantId: number, id: number) {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, tenant_id, concretagem_id, numero, tipo, data_emissao,
              laboratorio_nome, laboratorio_id, arquivo_url, ged_documento_id,
              resultado, observacoes, aprovado_por, aprovado_em,
              criado_por, created_at, updated_at
       FROM laudos_laboratorio
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      id,
    );

    if (!rows[0]) throw new NotFoundException('Laudo não encontrado');

    return rows[0];
  }

  // ── Aprovar laudo ─────────────────────────────────────────────────────────

  async aprovar(tenantId: number, id: number, userId: number) {
    const antes = await this.buscar(tenantId, id);

    await this.prisma.$executeRawUnsafe(
      `UPDATE laudos_laboratorio
       SET resultado = 'APROVADO', aprovado_por = $3, aprovado_em = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      id,
      userId,
    );

    this.auditLog(tenantId, userId, 'APROVAR', id, antes, { resultado: 'APROVADO' }).catch(
      (e: unknown) => this.logger.error(`auditLog laudo aprovar falhou: ${e}`),
    );

    return this.buscar(tenantId, id);
  }

  // ── Reprovar laudo ────────────────────────────────────────────────────────

  async reprovar(tenantId: number, id: number, userId: number) {
    const antes = await this.buscar(tenantId, id);

    await this.prisma.$executeRawUnsafe(
      `UPDATE laudos_laboratorio
       SET resultado = 'REPROVADO', aprovado_por = $3, aprovado_em = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      id,
      userId,
    );

    this.auditLog(tenantId, userId, 'REPROVAR', id, antes, { resultado: 'REPROVADO' }).catch(
      (e: unknown) => this.logger.error(`auditLog laudo reprovar falhou: ${e}`),
    );

    return this.buscar(tenantId, id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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
       VALUES ($1, $2, $3, 'laudo_laboratorio', $4, $5::jsonb, $6::jsonb)`,
      tenantId,
      userId,
      acao,
      entidadeId,
      JSON.stringify(antes),
      JSON.stringify(depois),
    );
  }
}
