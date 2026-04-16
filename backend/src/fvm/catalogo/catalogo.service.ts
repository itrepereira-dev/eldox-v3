// backend/src/fvm/catalogo/catalogo.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FvmCategoria, FvmMaterial, FvmItem } from '../types/fvm.types';
import type { CreateCategoriaDto } from './dto/create-categoria.dto';
import type { UpdateCategoriaDto } from './dto/update-categoria.dto';
import type { CreateMaterialDto } from './dto/create-material.dto';
import type { UpdateMaterialDto } from './dto/update-material.dto';
import type { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class CatalogoFvmService {
  private readonly logger = new Logger(CatalogoFvmService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Guard: protege registros do sistema (tenant_id = 0) ────────────────────

  private static readonly ALLOWED_GUARD_TABLES = new Set([
    'fvm_categorias_materiais',
    'fvm_catalogo_materiais',
    'fvm_catalogo_itens',
  ]);

  private async assertNotSistema(tabela: string, id: number): Promise<void> {
    if (!CatalogoFvmService.ALLOWED_GUARD_TABLES.has(tabela)) {
      throw new Error(`assertNotSistema: tabela não permitida "${tabela}"`);
    }
    const rows = await this.prisma.$queryRawUnsafe<{ tenant_id: number }[]>(
      `SELECT tenant_id FROM ${tabela} WHERE id = $1`,
      id,
    );
    if (!rows.length) throw new NotFoundException(`Registro ${id} não encontrado`);
    if (rows[0].tenant_id === 0) {
      throw new ForbiddenException(
        'Registros do sistema (PBQP-H) não podem ser modificados. Use "Clonar" para criar uma cópia editável.',
      );
    }
  }

  // ── Categorias ──────────────────────────────────────────────────────────────

  async getCategorias(tenantId: number): Promise<FvmCategoria[]> {
    return this.prisma.$queryRawUnsafe<FvmCategoria[]>(
      `SELECT c.*,
              (c.tenant_id = 0) AS is_sistema,
              COUNT(m.id)::int   AS total_materiais
       FROM fvm_categorias_materiais c
       LEFT JOIN fvm_catalogo_materiais m
              ON m.categoria_id = c.id AND m.ativo = true AND m.deleted_at IS NULL
       WHERE c.tenant_id IN (0, $1) AND c.ativo = true
       GROUP BY c.id
       ORDER BY c.ordem ASC, c.nome ASC`,
      tenantId,
    );
  }

  async createCategoria(tenantId: number, dto: CreateCategoriaDto): Promise<FvmCategoria> {
    const rows = await this.prisma.$queryRawUnsafe<FvmCategoria[]>(
      `INSERT INTO fvm_categorias_materiais (tenant_id, nome, descricao, icone, ordem)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      tenantId, dto.nome, dto.descricao ?? null, dto.icone ?? null, dto.ordem ?? 0,
    );
    return rows[0];
  }

  async updateCategoria(tenantId: number, id: number, dto: UpdateCategoriaDto): Promise<FvmCategoria> {
    await this.assertNotSistema('fvm_categorias_materiais', id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome      !== undefined) { sets.push(`nome = $${i++}`);     vals.push(dto.nome); }
    if (dto.descricao !== undefined) { sets.push(`descricao = $${i++}`); vals.push(dto.descricao); }
    if (dto.icone     !== undefined) { sets.push(`icone = $${i++}`);    vals.push(dto.icone); }
    if (dto.ordem     !== undefined) { sets.push(`ordem = $${i++}`);    vals.push(dto.ordem); }
    if (dto.ativo     !== undefined) { sets.push(`ativo = $${i++}`);    vals.push(dto.ativo); }
    if (!sets.length) return this.getCategoriaOuFalhar(tenantId, id);
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<FvmCategoria[]>(
      `UPDATE fvm_categorias_materiais SET ${sets.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i++}
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException(`Categoria ${id} não encontrada`);
    return rows[0];
  }

  async deleteCategoria(tenantId: number, id: number): Promise<void> {
    await this.assertNotSistema('fvm_categorias_materiais', id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvm_categorias_materiais SET ativo = false, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
  }

  private async getCategoriaOuFalhar(tenantId: number, id: number): Promise<FvmCategoria> {
    const rows = await this.prisma.$queryRawUnsafe<FvmCategoria[]>(
      `SELECT *, (tenant_id = 0) AS is_sistema FROM fvm_categorias_materiais
       WHERE id = $1 AND tenant_id IN (0, $2)`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Categoria ${id} não encontrada`);
    return rows[0];
  }

  // ── Materiais ──────────────────────────────────────────────────────────────

  async getMateriais(tenantId: number, categoriaId?: number): Promise<FvmMaterial[]> {
    const where = categoriaId
      ? `AND m.categoria_id = $2`
      : '';
    const params: unknown[] = categoriaId ? [tenantId, categoriaId] : [tenantId];
    return this.prisma.$queryRawUnsafe<FvmMaterial[]>(
      `SELECT m.*,
              (m.tenant_id = 0)    AS is_sistema,
              c.nome               AS categoria_nome,
              COUNT(DISTINCT i.id)::int AS total_itens,
              COUNT(DISTINCT d.id)::int AS total_documentos
       FROM fvm_catalogo_materiais m
       LEFT JOIN fvm_categorias_materiais c ON c.id = m.categoria_id
       LEFT JOIN fvm_catalogo_itens        i ON i.material_id = m.id AND i.ativo = true
       LEFT JOIN fvm_documentos_exigidos   d ON d.material_id = m.id
       WHERE m.tenant_id IN (0, $1) AND m.ativo = true AND m.deleted_at IS NULL
       ${where}
       GROUP BY m.id, c.nome
       ORDER BY m.ordem ASC, m.nome ASC`,
      ...params,
    );
  }

  async getMaterial(tenantId: number, id: number): Promise<FvmMaterial & { itens: FvmItem[] }> {
    const rows = await this.prisma.$queryRawUnsafe<FvmMaterial[]>(
      `SELECT m.*, (m.tenant_id = 0) AS is_sistema, c.nome AS categoria_nome
       FROM fvm_catalogo_materiais m
       LEFT JOIN fvm_categorias_materiais c ON c.id = m.categoria_id
       WHERE m.id = $1 AND m.tenant_id IN (0, $2) AND m.deleted_at IS NULL`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Material ${id} não encontrado`);
    const itens = await this.prisma.$queryRawUnsafe<FvmItem[]>(
      `SELECT * FROM fvm_catalogo_itens
       WHERE material_id = $1 AND ativo = true
       ORDER BY ordem ASC`,
      id,
    );
    return { ...rows[0], itens };
  }

  async createMaterial(tenantId: number, dto: CreateMaterialDto): Promise<FvmMaterial> {
    const rows = await this.prisma.$queryRawUnsafe<FvmMaterial[]>(
      `INSERT INTO fvm_catalogo_materiais
         (tenant_id, categoria_id, nome, codigo, norma_referencia, unidade,
          descricao, foto_modo, exige_certificado, exige_nota_fiscal,
          exige_laudo_ensaio, prazo_quarentena_dias, ordem)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      tenantId,
      dto.categoria_id,
      dto.nome,
      dto.codigo ?? null,
      dto.norma_referencia ?? null,
      dto.unidade ?? 'un',
      dto.descricao ?? null,
      dto.foto_modo ?? 'opcional',
      dto.exige_certificado ?? false,
      dto.exige_nota_fiscal ?? true,
      dto.exige_laudo_ensaio ?? false,
      dto.prazo_quarentena_dias ?? 0,
      dto.ordem ?? 0,
    );
    return rows[0];
  }

  async updateMaterial(tenantId: number, id: number, dto: UpdateMaterialDto): Promise<FvmMaterial> {
    await this.assertNotSistema('fvm_catalogo_materiais', id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    const fields: [keyof UpdateMaterialDto, string][] = [
      ['nome', 'nome'], ['codigo', 'codigo'], ['norma_referencia', 'norma_referencia'],
      ['unidade', 'unidade'], ['descricao', 'descricao'], ['foto_modo', 'foto_modo'],
      ['exige_certificado', 'exige_certificado'], ['exige_nota_fiscal', 'exige_nota_fiscal'],
      ['exige_laudo_ensaio', 'exige_laudo_ensaio'], ['prazo_quarentena_dias', 'prazo_quarentena_dias'],
      ['ordem', 'ordem'], ['ativo', 'ativo'],
    ];
    for (const [key, col] of fields) {
      if (dto[key] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(dto[key]); }
    }
    if (!sets.length) return (await this.getMaterial(tenantId, id));
    sets.push(`updated_at = NOW()`);
    vals.push(id, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<FvmMaterial[]>(
      `UPDATE fvm_catalogo_materiais SET ${sets.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i++}
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException(`Material ${id} não encontrado`);
    return rows[0];
  }

  async deleteMaterial(tenantId: number, id: number): Promise<void> {
    await this.assertNotSistema('fvm_catalogo_materiais', id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvm_catalogo_materiais SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
  }

  // ── Itens de verificação ───────────────────────────────────────────────────

  async createItem(tenantId: number, materialId: number, dto: CreateItemDto): Promise<FvmItem> {
    // Verifica se o material existe e é acessível por este tenant
    await this.getMaterial(tenantId, materialId);
    // Itens do sistema podem ser adicionados somente ao material do tenant
    const materialRows = await this.prisma.$queryRawUnsafe<{ tenant_id: number }[]>(
      `SELECT tenant_id FROM fvm_catalogo_materiais WHERE id = $1`, materialId,
    );
    if (materialRows[0].tenant_id === 0) {
      throw new ForbiddenException('Itens não podem ser adicionados a materiais do sistema PBQP-H.');
    }
    const rows = await this.prisma.$queryRawUnsafe<FvmItem[]>(
      `INSERT INTO fvm_catalogo_itens
         (tenant_id, material_id, tipo, descricao, criterio_aceite, criticidade, foto_modo, ordem)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      tenantId, materialId,
      dto.tipo, dto.descricao, dto.criterio_aceite ?? null,
      dto.criticidade ?? 'menor', dto.foto_modo ?? 'opcional', dto.ordem ?? 0,
    );
    return rows[0];
  }

  async updateItem(tenantId: number, itemId: number, dto: Partial<CreateItemDto> & { ativo?: boolean }): Promise<FvmItem> {
    await this.assertNotSistema('fvm_catalogo_itens', itemId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.tipo             !== undefined) { sets.push(`tipo = $${i++}`);              vals.push(dto.tipo); }
    if (dto.descricao        !== undefined) { sets.push(`descricao = $${i++}`);         vals.push(dto.descricao); }
    if (dto.criterio_aceite  !== undefined) { sets.push(`criterio_aceite = $${i++}`);   vals.push(dto.criterio_aceite); }
    if (dto.criticidade      !== undefined) { sets.push(`criticidade = $${i++}`);       vals.push(dto.criticidade); }
    if (dto.foto_modo        !== undefined) { sets.push(`foto_modo = $${i++}`);         vals.push(dto.foto_modo); }
    if (dto.ordem            !== undefined) { sets.push(`ordem = $${i++}`);             vals.push(dto.ordem); }
    if (dto.ativo            !== undefined) { sets.push(`ativo = $${i++}`);             vals.push(dto.ativo); }
    if (!sets.length) throw new NotFoundException('Nenhum campo para atualizar');
    vals.push(itemId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<FvmItem[]>(
      `UPDATE fvm_catalogo_itens SET ${sets.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i++}
       RETURNING *`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException(`Item ${itemId} não encontrado`);
    return rows[0];
  }

  async deleteItem(tenantId: number, itemId: number): Promise<void> {
    await this.assertNotSistema('fvm_catalogo_itens', itemId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvm_catalogo_itens SET ativo = false WHERE id = $1 AND tenant_id = $2`,
      itemId, tenantId,
    );
  }
}
