// backend/src/concretagem/racs/racs.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateRacDto } from './dto/create-rac.dto';

interface UpdateRacFields {
  titulo?: string;
  descricao_problema?: string;
  causa_raiz?: string;
  acao_corretiva?: string;
  acao_preventiva?: string;
  responsavel_id?: number;
  prazo?: string;
  status?: string;
}

@Injectable()
export class RacsService {
  private readonly logger = new Logger(RacsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Criar RAC ─────────────────────────────────────────────────────────────

  async criar(tenantId: number, userId: number, dto: CreateRacDto) {
    // Insert with temporary numero, then update with auto-number
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO racs
         (tenant_id, obra_id, nc_id, numero, titulo, descricao_problema,
          causa_raiz, acao_corretiva, acao_preventiva, responsavel_id,
          prazo, status, criado_por, updated_at)
       VALUES ($1,$2,$3,'TEMP',$4,$5,$6,$7,$8,$9,$10,'ABERTA',$11,NOW())
       RETURNING id`,
      tenantId,
      dto.obra_id,
      dto.nc_id ?? null,
      dto.titulo,
      dto.descricao_problema,
      dto.causa_raiz ?? null,
      dto.acao_corretiva ?? null,
      dto.acao_preventiva ?? null,
      dto.responsavel_id ?? null,
      dto.prazo ?? null,
      userId,
    );

    const id = rows[0].id;
    const numero = `RAC-${dto.obra_id}-${String(id).padStart(4, '0')}`;

    await this.prisma.$executeRawUnsafe(
      `UPDATE racs SET numero = $1 WHERE id = $2`,
      numero,
      id,
    );

    this.auditLog(tenantId, userId, 'CREATE', id, null, dto).catch(
      (e: unknown) => this.logger.error(`auditLog RAC falhou: ${e}`),
    );

    return this.buscar(tenantId, id);
  }

  // ── Listar RACs ───────────────────────────────────────────────────────────

  async listar(tenantId: number, obraId: number, status?: string) {
    const params: unknown[] = [tenantId, obraId];
    const conditions: string[] = [
      'tenant_id = $1',
      'obra_id = $2',
      'deleted_at IS NULL',
    ];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, tenant_id, obra_id, nc_id, numero, titulo, descricao_problema,
              causa_raiz, acao_corretiva, acao_preventiva, responsavel_id,
              prazo, status, eficacia_verificada, eficacia_verificada_por,
              eficacia_verificada_em, criado_por, created_at, updated_at
       FROM racs
       WHERE ${where}
       ORDER BY created_at DESC`,
      ...params,
    );

    return rows;
  }

  // ── Buscar RAC ────────────────────────────────────────────────────────────

  async buscar(tenantId: number, id: number) {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, tenant_id, obra_id, nc_id, numero, titulo, descricao_problema,
              causa_raiz, acao_corretiva, acao_preventiva, responsavel_id,
              prazo, status, eficacia_verificada, eficacia_verificada_por,
              eficacia_verificada_em, criado_por, created_at, updated_at
       FROM racs
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      tenantId,
      id,
    );

    if (!rows[0]) throw new NotFoundException('RAC não encontrada');

    return rows[0];
  }

  // ── Atualizar RAC ─────────────────────────────────────────────────────────

  async atualizar(
    tenantId: number,
    id: number,
    userId: number,
    dto: UpdateRacFields,
  ) {
    const antes = await this.buscar(tenantId, id);

    const sets: string[] = [];
    const params: unknown[] = [tenantId, id];
    let idx = 3;

    const fieldMap: (keyof UpdateRacFields)[] = [
      'titulo',
      'descricao_problema',
      'causa_raiz',
      'acao_corretiva',
      'acao_preventiva',
      'responsavel_id',
      'prazo',
      'status',
    ];

    for (const field of fieldMap) {
      if (dto[field] !== undefined) {
        sets.push(`${field} = $${idx++}`);
        params.push(dto[field] ?? null);
      }
    }

    if (sets.length === 0) return antes;

    sets.push('updated_at = NOW()');

    await this.prisma.$executeRawUnsafe(
      `UPDATE racs SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      ...params,
    );

    this.auditLog(tenantId, userId, 'UPDATE', id, antes, dto).catch(
      (e: unknown) => this.logger.error(`auditLog RAC atualizar falhou: ${e}`),
    );

    return this.buscar(tenantId, id);
  }

  // ── Verificar eficácia ────────────────────────────────────────────────────

  async verificarEficacia(tenantId: number, id: number, userId: number) {
    const antes = await this.buscar(tenantId, id);

    await this.prisma.$executeRawUnsafe(
      `UPDATE racs
       SET eficacia_verificada = TRUE,
           eficacia_verificada_por = $3,
           eficacia_verificada_em = NOW(),
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      tenantId,
      id,
      userId,
    );

    this.auditLog(tenantId, userId, 'VERIFICAR_EFICACIA', id, antes, { eficacia_verificada: true }).catch(
      (e: unknown) => this.logger.error(`auditLog RAC verificarEficacia falhou: ${e}`),
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
       VALUES ($1, $2, $3, 'rac', $4, $5::jsonb, $6::jsonb)`,
      tenantId,
      userId,
      acao,
      entidadeId,
      JSON.stringify(antes),
      JSON.stringify(depois),
    );
  }
}
