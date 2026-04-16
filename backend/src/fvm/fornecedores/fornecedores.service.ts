// backend/src/fvm/fornecedores/fornecedores.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FvmFornecedor } from '../types/fvm.types';
import type { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import type { CreateFornecedorRapidoDto } from './dto/create-fornecedor-rapido.dto';
import type { UpdateFornecedorDto } from './dto/update-fornecedor.dto';

@Injectable()
export class FornecedoresService {
  private readonly logger = new Logger(FornecedoresService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getFornecedores(
    tenantId: number,
    opts?: { situacao?: string; search?: string },
  ): Promise<FvmFornecedor[]> {
    const conditions: string[] = ['f.tenant_id = $1', 'f.deleted_at IS NULL'];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (opts?.situacao) {
      conditions.push(`f.situacao = $${i++}`);
      params.push(opts.situacao);
    }
    if (opts?.search) {
      conditions.push(`(f.razao_social ILIKE $${i} OR f.nome_fantasia ILIKE $${i} OR f.cnpj ILIKE $${i})`);
      params.push(`%${opts.search}%`);
      i++;
    }

    return this.prisma.$queryRawUnsafe<FvmFornecedor[]>(
      `SELECT f.*,
              COUNT(l.id)::int                                          AS total_entregas,
              COUNT(l.id) FILTER (WHERE l.status = 'aprovado')::int    AS entregas_aprovadas
       FROM fvm_fornecedores f
       LEFT JOIN fvm_lotes l ON l.fornecedor_id = f.id AND l.tenant_id = f.tenant_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY f.id
       ORDER BY f.razao_social ASC`,
      ...params,
    );
  }

  async getFornecedor(tenantId: number, id: number): Promise<FvmFornecedor> {
    const rows = await this.prisma.$queryRawUnsafe<FvmFornecedor[]>(
      `SELECT f.*,
              COUNT(l.id)::int                                         AS total_entregas,
              COUNT(l.id) FILTER (WHERE l.status = 'aprovado')::int   AS entregas_aprovadas
       FROM fvm_fornecedores f
       LEFT JOIN fvm_lotes l ON l.fornecedor_id = f.id AND l.tenant_id = f.tenant_id
       WHERE f.id = $1 AND f.tenant_id = $2 AND f.deleted_at IS NULL
       GROUP BY f.id`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Fornecedor ${id} não encontrado`);
    return rows[0];
  }

  async createFornecedor(tenantId: number, usuarioId: number, dto: CreateFornecedorDto): Promise<FvmFornecedor> {
    if (dto.cnpj) {
      const existing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM fvm_fornecedores WHERE tenant_id = $1 AND cnpj = $2 AND deleted_at IS NULL`,
        tenantId, dto.cnpj,
      );
      if (existing.length) throw new ConflictException(`Já existe um fornecedor com CNPJ ${dto.cnpj}`);
    }
    const rows = await this.prisma.$queryRawUnsafe<FvmFornecedor[]>(
      `INSERT INTO fvm_fornecedores
         (tenant_id, razao_social, nome_fantasia, cnpj, tipo, email,
          telefone, responsavel_comercial, endereco, cidade, uf,
          observacoes, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      tenantId,
      dto.razao_social,
      dto.nome_fantasia ?? null,
      dto.cnpj ?? null,
      dto.tipo ?? 'fabricante',
      dto.email ?? null,
      dto.telefone ?? null,
      dto.responsavel_comercial ?? null,
      dto.endereco ?? null,
      dto.cidade ?? null,
      dto.uf ?? null,
      dto.observacoes ?? null,
      usuarioId,
    );
    return rows[0];
  }

  /**
   * Criação rápida inline — usada no NovoLoteModal para eliminar bloqueio
   * de 7 passos ao receber primeiro lote de fornecedor novo.
   */
  async createFornecedorRapido(
    tenantId: number,
    usuarioId: number,
    dto: CreateFornecedorRapidoDto,
  ): Promise<Pick<FvmFornecedor, 'id' | 'razao_social' | 'situacao'>> {
    if (dto.cnpj) {
      const existing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM fvm_fornecedores WHERE tenant_id = $1 AND cnpj = $2 AND deleted_at IS NULL`,
        tenantId, dto.cnpj,
      );
      if (existing.length) throw new ConflictException(`Já existe um fornecedor com CNPJ ${dto.cnpj}`);
    }
    const rows = await this.prisma.$queryRawUnsafe<Pick<FvmFornecedor, 'id' | 'razao_social' | 'situacao'>[]>(
      `INSERT INTO fvm_fornecedores (tenant_id, razao_social, cnpj, telefone, criado_por)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, razao_social, situacao`,
      tenantId, dto.razao_social, dto.cnpj ?? null, dto.telefone ?? null, usuarioId,
    );
    return rows[0];
  }

  async updateFornecedor(tenantId: number, id: number, dto: UpdateFornecedorDto): Promise<FvmFornecedor> {
    // Bloqueio de CNPJ duplicado ao mudar
    if (dto.cnpj) {
      const existing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM fvm_fornecedores WHERE tenant_id = $1 AND cnpj = $2 AND id != $3 AND deleted_at IS NULL`,
        tenantId, dto.cnpj, id,
      );
      if (existing.length) throw new ConflictException(`Já existe outro fornecedor com CNPJ ${dto.cnpj}`);
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    const fields: [keyof UpdateFornecedorDto, string][] = [
      ['razao_social', 'razao_social'], ['nome_fantasia', 'nome_fantasia'],
      ['cnpj', 'cnpj'], ['tipo', 'tipo'], ['situacao', 'situacao'],
      ['email', 'email'], ['telefone', 'telefone'],
      ['responsavel_comercial', 'responsavel_comercial'],
      ['endereco', 'endereco'], ['cidade', 'cidade'], ['uf', 'uf'],
      ['observacoes', 'observacoes'],
    ];
    for (const [key, col] of fields) {
      if (dto[key] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(dto[key]); }
    }
    if (!sets.length) return this.getFornecedor(tenantId, id);
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<FvmFornecedor[]>(
      `UPDATE fvm_fornecedores SET ${sets.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i++} AND deleted_at IS NULL
       RETURNING *`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException(`Fornecedor ${id} não encontrado`);
    return rows[0];
  }

  async deleteFornecedor(tenantId: number, id: number): Promise<void> {
    // Não permite exclusão se há lotes vinculados
    const lotes = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM fvm_lotes
       WHERE fornecedor_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      id, tenantId,
    );
    if (lotes[0].count > 0) {
      throw new BadRequestException(
        'Fornecedor possui entregas registradas e não pode ser excluído. Suspenda-o em vez disso.',
      );
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvm_fornecedores SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
  }
}
