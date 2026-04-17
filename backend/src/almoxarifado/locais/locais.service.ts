// backend/src/almoxarifado/locais/locais.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmLocal } from '../types/alm.types';
import type { CreateLocalDto } from './dto/create-local.dto';
import type { UpdateLocalDto } from './dto/update-local.dto';

@Injectable()
export class LocaisService {
  private readonly logger = new Logger(LocaisService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listar(
    tenantId: number,
    filters: { tipo?: string; ativo?: boolean; obra_id?: number } = {},
  ): Promise<AlmLocal[]> {
    const conditions: string[] = [`l.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.tipo) {
      conditions.push(`l.tipo = $${i++}`);
      params.push(filters.tipo);
    }
    if (filters.ativo !== undefined) {
      conditions.push(`l.ativo = $${i++}`);
      params.push(filters.ativo);
    } else {
      conditions.push(`l.ativo = true`);
    }
    if (filters.obra_id) {
      conditions.push(`l.obra_id = $${i++}`);
      params.push(filters.obra_id);
    }

    return this.prisma.$queryRawUnsafe<AlmLocal[]>(
      `SELECT l.*, o.nome AS obra_nome
       FROM alm_locais l
       LEFT JOIN "Obra" o ON o.id = l.obra_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.tipo ASC, l.nome ASC`,
      ...params,
    );
  }

  async buscarPorId(tenantId: number, id: number): Promise<AlmLocal> {
    const rows = await this.prisma.$queryRawUnsafe<AlmLocal[]>(
      `SELECT l.*, o.nome AS obra_nome
       FROM alm_locais l
       LEFT JOIN "Obra" o ON o.id = l.obra_id
       WHERE l.id = $1 AND l.tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException('Local não encontrado');
    return rows[0];
  }

  async criar(tenantId: number, dto: CreateLocalDto): Promise<AlmLocal> {
    if (dto.tipo === 'OBRA' && !dto.obra_id) {
      throw new BadRequestException('obra_id é obrigatório para locais do tipo OBRA');
    }
    if (dto.tipo !== 'OBRA' && dto.obra_id) {
      throw new BadRequestException('obra_id só é permitido para locais do tipo OBRA');
    }

    const existing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_locais WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2)`,
      tenantId, dto.nome,
    );
    if (existing.length) {
      throw new ConflictException('Já existe um local com este nome neste tenant');
    }

    const rows = await this.prisma.$queryRawUnsafe<AlmLocal[]>(
      `INSERT INTO alm_locais
         (tenant_id, tipo, nome, descricao, obra_id, endereco, responsavel_nome, ativo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       RETURNING *`,
      tenantId, dto.tipo, dto.nome,
      dto.descricao ?? null, dto.obra_id ?? null,
      dto.endereco ?? null, dto.responsavel_nome ?? null,
    );

    this.logger.log(JSON.stringify({ action: 'alm.locais.criar', tenantId, localId: rows[0].id }));
    return rows[0];
  }

  /**
   * Auto-creates an OBRA-type local when an obra is created.
   * Called from obras.service.ts inside the same transaction.
   */
  async createObraLocal(
    tx: any,
    tenantId: number,
    obraId: number,
    obraNome: string,
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO alm_locais (tenant_id, tipo, nome, obra_id, ativo, created_at, updated_at)
       VALUES ($1, 'OBRA', $2, $3, true, NOW(), NOW())
       ON CONFLICT (tenant_id, nome) DO NOTHING`,
      tenantId,
      `Depósito — ${obraNome}`,
      obraId,
    );
  }

  async atualizar(tenantId: number, id: number, dto: UpdateLocalDto): Promise<AlmLocal> {
    const local = await this.buscarPorId(tenantId, id);

    if (dto.tipo && dto.tipo !== local.tipo) {
      const movimentos = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM alm_movimentos
         WHERE tenant_id = $1 AND local_id = $2`,
        tenantId, id,
      );
      if (movimentos[0].count > 0) {
        throw new ConflictException(
          'Não é possível alterar o tipo de um local que já possui movimentações de estoque',
        );
      }
    }

    const tipoFinal = dto.tipo ?? local.tipo;
    const obraIdFinal = dto.obra_id !== undefined ? dto.obra_id : local.obra_id;

    if (tipoFinal === 'OBRA' && !obraIdFinal) {
      throw new BadRequestException('obra_id é obrigatório para locais do tipo OBRA');
    }
    if (tipoFinal !== 'OBRA' && obraIdFinal) {
      throw new BadRequestException('obra_id só é permitido para locais do tipo OBRA');
    }

    if (dto.nome && dto.nome !== local.nome) {
      const existing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM alm_locais WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2) AND id != $3`,
        tenantId, dto.nome, id,
      );
      if (existing.length) {
        throw new ConflictException('Já existe um local com este nome neste tenant');
      }
    }

    const rows = await this.prisma.$queryRawUnsafe<AlmLocal[]>(
      `UPDATE alm_locais
       SET tipo             = COALESCE($3, tipo),
           nome             = COALESCE($4, nome),
           descricao        = COALESCE($5, descricao),
           obra_id          = $6,
           endereco         = COALESCE($7, endereco),
           responsavel_nome = COALESCE($8, responsavel_nome),
           updated_at       = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      id, tenantId,
      dto.tipo ?? null, dto.nome ?? null,
      dto.descricao ?? null, obraIdFinal,
      dto.endereco ?? null, dto.responsavel_nome ?? null,
    );

    return rows[0];
  }

  async desativar(tenantId: number, id: number): Promise<{ id: number; ativo: boolean }> {
    await this.buscarPorId(tenantId, id);

    const saldo = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM alm_estoque_saldo
       WHERE tenant_id = $1 AND local_id = $2 AND quantidade > 0`,
      tenantId, id,
    );
    if (saldo[0].count > 0) {
      throw new BadRequestException('Não é possível desativar um local com saldo em estoque');
    }

    const ocs = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM alm_ordens_compra
       WHERE tenant_id = $1 AND local_destino_id = $2
         AND status NOT IN ('cancelada', 'encerrada')`,
      tenantId, id,
    );
    if (ocs[0].count > 0) {
      throw new BadRequestException('Não é possível desativar um local com ordens de compra abertas');
    }

    const sols = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM alm_solicitacoes
       WHERE tenant_id = $1 AND local_destino_id = $2
         AND status NOT IN ('cancelada', 'encerrada')`,
      tenantId, id,
    );
    if (sols[0].count > 0) {
      throw new BadRequestException('Não é possível desativar um local com solicitações abertas');
    }

    const trans = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM alm_transferencias
       WHERE tenant_id = $1
         AND (local_origem_id = $2 OR local_destino_id = $2)
         AND status NOT IN ('executada', 'cancelada')`,
      tenantId, id,
    );
    if (trans[0].count > 0) {
      throw new BadRequestException('Não é possível desativar um local com transferências em andamento');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_locais SET ativo = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );

    this.logger.log(JSON.stringify({ action: 'alm.locais.desativar', tenantId, localId: id }));
    return { id, ativo: false };
  }
}
