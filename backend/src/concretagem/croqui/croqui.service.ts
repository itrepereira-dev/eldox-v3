// backend/src/concretagem/croqui/croqui.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCroquiDto } from './dto/create-croqui.dto';
import type { UpdateCroquiDto } from './dto/update-croqui.dto';

@Injectable()
export class CroquiService {
  private readonly logger = new Logger(CroquiService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Listar croquis de uma obra ────────────────────────────────────────────

  async listar(tenantId: number, obraId: number) {
    await this.validarObra(tenantId, obraId);

    return this.prisma.$queryRawUnsafe<
      {
        id: number;
        nome: string;
        obra_local_id: number | null;
        ia_confianca: number | null;
        created_at: Date;
      }[]
    >(
      `SELECT id, nome, obra_local_id, ia_confianca, created_at
       FROM concretagem_croquis
       WHERE tenant_id = $1
         AND obra_id   = $2
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      tenantId,
      obraId,
    );
  }

  // ── Buscar um croqui (com elementos completos) ────────────────────────────

  async buscar(tenantId: number, obraId: number, croquiId: number) {
    const rows = await this.prisma.$queryRawUnsafe<
      {
        id: number;
        obra_id: number;
        obra_local_id: number | null;
        nome: string;
        elementos: unknown;
        ia_confianca: number | null;
        criado_por: number;
        created_at: Date;
        updated_at: Date;
      }[]
    >(
      `SELECT id, obra_id, obra_local_id, nome, elementos,
              ia_confianca, criado_por, created_at, updated_at
       FROM concretagem_croquis
       WHERE tenant_id = $1
         AND obra_id   = $2
         AND id        = $3
         AND deleted_at IS NULL`,
      tenantId,
      obraId,
      croquiId,
    );

    if (!rows[0]) throw new NotFoundException('Croqui não encontrado');
    return rows[0];
  }

  // ── Criar croqui ──────────────────────────────────────────────────────────

  async criar(
    tenantId: number,
    obraId: number,
    userId: number,
    dto: CreateCroquiDto,
  ) {
    await this.validarObra(tenantId, obraId);

    // Verifica duplicata por obra_local_id
    if (dto.obra_local_id != null) {
      await this.checarDuplicata(tenantId, obraId, dto.obra_local_id);
    }

    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO concretagem_croquis
         (tenant_id, obra_id, obra_local_id, nome, elementos, ia_confianca, criado_por, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())
       RETURNING id`,
      tenantId,
      obraId,
      dto.obra_local_id ?? null,
      dto.nome,
      JSON.stringify(dto.elementos),
      dto.ia_confianca ?? null,
      userId,
    );

    await this.auditLog(tenantId, userId, 'CREATE', rows[0].id, null, dto);

    return this.buscar(tenantId, obraId, rows[0].id);
  }

  // ── Atualizar croqui ──────────────────────────────────────────────────────

  async atualizar(
    tenantId: number,
    obraId: number,
    croquiId: number,
    userId: number,
    dto: UpdateCroquiDto,
  ) {
    const antes = await this.buscar(tenantId, obraId, croquiId);

    // Verifica duplicata se está mudando obra_local_id
    if (
      dto.obra_local_id != null &&
      dto.obra_local_id !== antes.obra_local_id
    ) {
      await this.checarDuplicata(tenantId, obraId, dto.obra_local_id, croquiId);
    }

    const sets: string[] = [];
    const params: unknown[] = [tenantId, obraId, croquiId];
    let idx = 4;

    if (dto.nome !== undefined) {
      sets.push(`nome = $${idx++}`);
      params.push(dto.nome);
    }
    if ('obra_local_id' in dto) {
      sets.push(`obra_local_id = $${idx++}`);
      params.push(dto.obra_local_id ?? null);
    }
    if (dto.elementos !== undefined) {
      sets.push(`elementos = $${idx++}::jsonb`);
      params.push(JSON.stringify(dto.elementos));
    }

    if (sets.length === 0) return antes;

    sets.push('updated_at = NOW()');

    await this.prisma.$executeRawUnsafe(
      `UPDATE concretagem_croquis
       SET ${sets.join(', ')}
       WHERE tenant_id = $1 AND obra_id = $2 AND id = $3 AND deleted_at IS NULL`,
      ...params,
    );

    await this.auditLog(tenantId, userId, 'UPDATE', croquiId, antes, dto);

    return this.buscar(tenantId, obraId, croquiId);
  }

  // ── Deletar croqui (soft delete) ──────────────────────────────────────────

  async deletar(
    tenantId: number,
    obraId: number,
    croquiId: number,
    userId: number,
  ) {
    await this.buscar(tenantId, obraId, croquiId); // valida existência

    // Verifica vínculos com concretagens (quando a tabela concretagens existir)
    // Por ora: soft delete direto
    await this.prisma.$executeRawUnsafe(
      `UPDATE concretagem_croquis
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND obra_id = $2 AND id = $3`,
      tenantId,
      obraId,
      croquiId,
    );

    await this.auditLog(tenantId, userId, 'DELETE', croquiId, null, null);

    return { id: croquiId };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async validarObra(tenantId: number, obraId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "Obra" WHERE id = $1 AND "tenantId" = $2`,
      obraId,
      tenantId,
    );
    if (!rows[0]) throw new NotFoundException('Obra não encontrada');
  }

  private async checarDuplicata(
    tenantId: number,
    obraId: number,
    obraLocalId: number,
    excluirId?: number,
  ): Promise<void> {
    const params: unknown[] = [tenantId, obraId, obraLocalId];
    const excludeClause =
      excluirId != null
        ? `AND id != $${(params.push(excluirId), params.length)}`
        : '';

    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM concretagem_croquis
       WHERE tenant_id     = $1
         AND obra_id       = $2
         AND obra_local_id = $3
         AND deleted_at    IS NULL
         ${excludeClause}`,
      ...params,
    );
    if (rows[0]) {
      throw new ConflictException(
        'Já existe um croqui para este local. Edite o existente.',
      );
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
    return this.prisma
      .$executeRawUnsafe(
        `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
         VALUES ($1, $2, $3, 'concretagem_croqui', $4, $5::jsonb, $6::jsonb)`,
        tenantId,
        userId,
        acao,
        entidadeId,
        JSON.stringify(antes),
        JSON.stringify(depois),
      )
      .catch((err: unknown) =>
        this.logger.error(`auditLog croqui falhou: ${String(err)}`),
      );
  }
}
