// backend/src/fvs/catalogo/catalogo.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FvsCategoria, FvsServico, FvsItem } from '../types/fvs.types';
import type { CreateCategoriaDto } from './dto/create-categoria.dto';
import type { UpdateCategoriaDto } from './dto/update-categoria.dto';
import type { CreateServicoDto } from './dto/create-servico.dto';
import type { UpdateServicoDto } from './dto/update-servico.dto';
import type { CreateItemDto } from './dto/create-item.dto';
import type { UpdateItemDto } from './dto/update-item.dto';
import type { ReorderItemDto } from './dto/reorder.dto';

@Injectable()
export class CatalogoService {
  private readonly logger = new Logger(CatalogoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Guard helper ────────────────────────────────────────────────────────────

  private static readonly ALLOWED_GUARD_TABLES = new Set([
    'fvs_categorias_servico',
    'fvs_catalogo_servicos',
    'fvs_catalogo_itens',
  ]);

  private async assertNotSistema(tabela: string, id: number): Promise<void> {
    if (!CatalogoService.ALLOWED_GUARD_TABLES.has(tabela)) {
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

  async getCategorias(tenantId: number): Promise<FvsCategoria[]> {
    const rows = await this.prisma.$queryRawUnsafe<FvsCategoria[]>(
      `SELECT *, (tenant_id = 0) AS is_sistema
       FROM fvs_categorias_servico
       WHERE tenant_id IN (0, $1) AND ativo = true
       ORDER BY ordem ASC, nome ASC`,
      tenantId,
    );
    return rows.map((r) => ({ ...r, is_sistema: r.tenant_id === 0 }));
  }

  async createCategoria(tenantId: number, dto: CreateCategoriaDto): Promise<FvsCategoria> {
    const rows = await this.prisma.$queryRawUnsafe<FvsCategoria[]>(
      `INSERT INTO fvs_categorias_servico (tenant_id, nome, ordem)
       VALUES ($1, $2, $3)
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      tenantId,
      dto.nome,
      dto.ordem ?? 0,
    );
    return rows[0];
  }

  async updateCategoria(tenantId: number, id: number, dto: UpdateCategoriaDto): Promise<FvsCategoria> {
    await this.assertNotSistema('fvs_categorias_servico', id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome    !== undefined) { sets.push(`nome = $${i++}`);   vals.push(dto.nome); }
    if (dto.ordem   !== undefined) { sets.push(`ordem = $${i++}`);  vals.push(dto.ordem); }
    if (dto.ativo   !== undefined) { sets.push(`ativo = $${i++}`);  vals.push(dto.ativo); }
    if (!sets.length) return this.getCategoriaById(tenantId, id);
    vals.push(id);
    vals.push(tenantId);
    const rows = await this.prisma.$queryRawUnsafe<FvsCategoria[]>(
      `UPDATE fvs_categorias_servico SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *, (tenant_id = 0) AS is_sistema`,
      ...vals,
    );
    return rows[0];
  }

  async deleteCategoria(tenantId: number, id: number): Promise<void> {
    await this.assertNotSistema('fvs_categorias_servico', id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_categorias_servico SET ativo = false WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
  }

  async reordenarCategorias(tenantId: number, itens: ReorderItemDto[]): Promise<void> {
    await this.prisma.$transaction(
      itens.map((item) =>
        this.prisma.$executeRawUnsafe(
          `UPDATE fvs_categorias_servico SET ordem = $1 WHERE id = $2 AND tenant_id = $3`,
          item.ordem,
          item.id,
          tenantId,
        ),
      ),
    );
  }

  private async getCategoriaById(tenantId: number, id: number): Promise<FvsCategoria> {
    const rows = await this.prisma.$queryRawUnsafe<FvsCategoria[]>(
      `SELECT *, (tenant_id = 0) AS is_sistema FROM fvs_categorias_servico WHERE id = $1 AND tenant_id IN (0, $2)`,
      id,
      tenantId,
    );
    if (!rows.length) throw new NotFoundException();
    return rows[0];
  }

  // ── Serviços ────────────────────────────────────────────────────────────────

  async getServicos(tenantId: number, categoriaId?: number): Promise<FvsServico[]> {
    const params: unknown[] = [tenantId];
    const where = categoriaId
      ? `AND s.categoria_id = $${params.push(Number(categoriaId))}`
      : '';
    const servicos = await this.prisma.$queryRawUnsafe<FvsServico[]>(
      `SELECT s.*, (s.tenant_id = 0) AS is_sistema
       FROM fvs_catalogo_servicos s
       WHERE s.tenant_id IN (0, $1) AND s.ativo = true AND s.deleted_at IS NULL ${where}
       ORDER BY s.ordem ASC, s.nome ASC`,
      ...params,
    );
    if (!servicos.length) return [];
    const ids = servicos.map((s) => s.id);
    const itens = await this.prisma.$queryRawUnsafe<FvsItem[]>(
      `SELECT * FROM fvs_catalogo_itens
       WHERE servico_id = ANY($1::int[])
       ORDER BY servico_id, ativo DESC, ordem ASC`,
      ids,
    );
    const itensByServico = new Map<number, FvsItem[]>();
    for (const item of itens) {
      if (!itensByServico.has(item.servico_id)) itensByServico.set(item.servico_id, []);
      itensByServico.get(item.servico_id)!.push(item);
    }
    return servicos.map((s) => ({ ...s, itens: itensByServico.get(s.id) ?? [] }));
  }

  async getServico(tenantId: number, id: number): Promise<FvsServico> {
    const rows = await this.prisma.$queryRawUnsafe<FvsServico[]>(
      `SELECT *, (tenant_id = 0) AS is_sistema
       FROM fvs_catalogo_servicos
       WHERE id = $1 AND tenant_id IN (0, $2) AND deleted_at IS NULL`,
      id,
      tenantId,
    );
    if (!rows.length) throw new NotFoundException();
    const servico = rows[0];
    const itens = await this.prisma.$queryRawUnsafe<FvsItem[]>(
      `SELECT * FROM fvs_catalogo_itens WHERE servico_id = $1 ORDER BY ativo DESC, ordem ASC`,
      id,
    );
    return { ...servico, itens };
  }

  async createServico(tenantId: number, dto: CreateServicoDto): Promise<FvsServico> {
    const rows = await this.prisma.$queryRawUnsafe<FvsServico[]>(
      `INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, norma_referencia, ordem)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      tenantId,
      dto.categoriaId ?? null,
      dto.codigo ?? null,
      dto.nome,
      dto.normaReferencia ?? null,
      dto.ordem ?? 0,
    );
    const servico = rows[0];
    if (dto.itens?.length) {
      for (let i = 0; i < dto.itens.length; i++) {
        await this._insertItem(tenantId, servico.id, dto.itens[i], i);
      }
    }
    return this.getServico(tenantId, servico.id);
  }

  async updateServico(tenantId: number, id: number, dto: UpdateServicoDto): Promise<FvsServico> {
    await this.assertNotSistema('fvs_catalogo_servicos', id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.categoriaId    !== undefined) { sets.push(`categoria_id = $${i++}`);     vals.push(dto.categoriaId); }
    if (dto.codigo         !== undefined) { sets.push(`codigo = $${i++}`);           vals.push(dto.codigo); }
    if (dto.nome           !== undefined) { sets.push(`nome = $${i++}`);             vals.push(dto.nome); }
    if (dto.normaReferencia !== undefined){ sets.push(`norma_referencia = $${i++}`); vals.push(dto.normaReferencia); }
    if (dto.ordem          !== undefined) { sets.push(`ordem = $${i++}`);            vals.push(dto.ordem); }
    if (dto.ativo          !== undefined) { sets.push(`ativo = $${i++}`);            vals.push(dto.ativo); }
    if (sets.length) {
      vals.push(id);
      vals.push(tenantId);
      await this.prisma.$executeRawUnsafe(
        `UPDATE fvs_catalogo_servicos SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1}`,
        ...vals,
      );
    }
    // Sync de itens: se enviados, apaga os existentes e recria
    if (dto.itens !== undefined) {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM fvs_catalogo_itens WHERE servico_id = $1 AND tenant_id = $2`,
        id,
        tenantId,
      );
      for (let j = 0; j < dto.itens.length; j++) {
        await this._insertItem(tenantId, id, dto.itens[j], j);
      }
    }
    return this.getServico(tenantId, id);
  }

  async deleteServico(tenantId: number, id: number): Promise<void> {
    await this.assertNotSistema('fvs_catalogo_servicos', id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_catalogo_servicos SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
  }

  async clonarServico(tenantId: number, originalId: number): Promise<FvsServico> {
    const original = await this.getServico(tenantId, originalId);
    const cloneRows = await this.prisma.$queryRawUnsafe<FvsServico[]>(
      `INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, norma_referencia, ordem)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      tenantId,
      original.categoria_id,
      original.codigo,
      `${original.nome} (cópia)`,
      original.norma_referencia,
      original.ordem,
    );
    const cloneServico = { ...cloneRows[0], is_sistema: cloneRows[0].tenant_id === 0 };
    const novoId = cloneServico.id;
    const cloneItens: FvsItem[] = [];
    if (original.itens?.length) {
      for (let i = 0; i < original.itens.length; i++) {
        const src = original.itens[i];
        const item = await this._insertItem(tenantId, novoId, {
          descricao:         src.descricao,
          criterioAceite:    src.criterio_aceite    ?? undefined,
          tolerancia:        src.tolerancia         ?? undefined,
          metodoVerificacao: src.metodo_verificacao ?? undefined,
          criticidade:       src.criticidade,
          fotoModo:          src.foto_modo,
          fotoMinimo:        src.foto_minimo,
          fotoMaximo:        src.foto_maximo,
          ordem:             src.ordem,
        }, i);
        cloneItens.push(item);
      }
    }
    return { ...cloneServico, itens: cloneItens };
  }

  // ── Itens ───────────────────────────────────────────────────────────────────

  async createItem(tenantId: number, servicoId: number, dto: CreateItemDto): Promise<FvsItem> {
    const rows = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::int FROM fvs_catalogo_servicos WHERE id = $1 AND tenant_id IN (0, $2)`,
      servicoId,
      tenantId,
    );
    if (!rows[0]?.count) throw new NotFoundException('Serviço não encontrado');
    return this._insertItem(tenantId, servicoId, dto);
  }

  async updateItem(tenantId: number, id: number, dto: UpdateItemDto): Promise<FvsItem> {
    await this.assertNotSistema('fvs_catalogo_itens', id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.descricao      !== undefined) { sets.push(`descricao = $${i++}`);       vals.push(dto.descricao); }
    if (dto.criterioAceite    !== undefined) { sets.push(`criterio_aceite = $${i++}`);    vals.push(dto.criterioAceite); }
    if (dto.tolerancia        !== undefined) { sets.push(`tolerancia = $${i++}`);        vals.push(dto.tolerancia); }
    if (dto.metodoVerificacao !== undefined) { sets.push(`metodo_verificacao = $${i++}`); vals.push(dto.metodoVerificacao); }
    if (dto.criticidade       !== undefined) { sets.push(`criticidade = $${i++}`);       vals.push(dto.criticidade); }
    if (dto.fotoModo          !== undefined) { sets.push(`foto_modo = $${i++}`);          vals.push(dto.fotoModo); }
    if (dto.fotoMinimo        !== undefined) { sets.push(`foto_minimo = $${i++}`);        vals.push(dto.fotoMinimo); }
    if (dto.fotoMaximo        !== undefined) { sets.push(`foto_maximo = $${i++}`);        vals.push(dto.fotoMaximo); }
    if (dto.ordem             !== undefined) { sets.push(`ordem = $${i++}`);              vals.push(dto.ordem); }
    if (dto.ativo             !== undefined) { sets.push(`ativo = $${i++}`);              vals.push(dto.ativo); }
    if (!sets.length) throw new BadRequestException('Nenhum campo para atualizar');
    vals.push(id);
    vals.push(tenantId);
    const rows = await this.prisma.$queryRawUnsafe<FvsItem[]>(
      `UPDATE fvs_catalogo_itens SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteItem(tenantId: number, id: number): Promise<void> {
    await this.assertNotSistema('fvs_catalogo_itens', id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_catalogo_itens SET ativo = false WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
  }

  async reordenarItens(tenantId: number, servicoId: number, itens: ReorderItemDto[]): Promise<void> {
    await this.prisma.$transaction(
      itens.map((item) =>
        this.prisma.$executeRawUnsafe(
          `UPDATE fvs_catalogo_itens SET ordem = $1 WHERE id = $2 AND servico_id = $3 AND tenant_id = $4`,
          item.ordem,
          item.id,
          servicoId,
          tenantId,
        ),
      ),
    );
  }

  // ── Importar CSV ────────────────────────────────────────────────────────────

  async importarCsv(
    tenantId: number,
    fileBuffer: Buffer,
    dryRun: boolean,
  ): Promise<{ preview: unknown[]; errors: string[]; total: number }> {
    const csv = fileBuffer.toString('utf-8');
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    const [header, ...dataLines] = lines;
    const cols = header.split(',').map((c) => c.trim().toLowerCase());
    const required = ['nome'];
    const missing = required.filter((r) => !cols.includes(r));
    if (missing.length) throw new BadRequestException(`Colunas obrigatórias ausentes: ${missing.join(', ')}`);

    const idx = (col: string) => cols.indexOf(col);
    const preview: unknown[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const cells = dataLines[i].split(',').map((c) => c.trim());
      const nome = cells[idx('nome')];
      if (!nome) { errors.push(`Linha ${i + 2}: campo "nome" obrigatório`); continue; }
      const CRITICIDADES = new Set(['critico', 'maior', 'menor']);
      const FOTO_MODOS = new Set(['nenhuma', 'opcional', 'obrigatoria']);
      const criticidade = cells[idx('criticidade')]?.toLowerCase() ?? 'menor';
      const fotoModo = cells[idx('foto_modo')]?.toLowerCase() ?? 'opcional';
      if (!CRITICIDADES.has(criticidade)) {
        errors.push(`Linha ${i + 2}: criticidade inválida "${criticidade}" (aceito: critico, maior, menor)`);
        continue;
      }
      if (!FOTO_MODOS.has(fotoModo)) {
        errors.push(`Linha ${i + 2}: foto_modo inválido "${fotoModo}" (aceito: nenhuma, opcional, obrigatoria)`);
        continue;
      }
      preview.push({
        categoria:          cells[idx('categoria')]          ?? null,
        codigo:             cells[idx('codigo')]             ?? null,
        nome,
        norma:              cells[idx('norma')]              ?? null,
        item_descricao:     cells[idx('item_descricao')]     ?? null,
        criterio_aceite:    cells[idx('criterio_aceite')]    ?? null,
        tolerancia:         cells[idx('tolerancia')]         ?? null,
        metodo_verificacao: cells[idx('metodo_verificacao')] ?? null,
        criticidade,
        foto_modo: fotoModo,
      });
    }

    if (dryRun || errors.length) return { preview, errors, total: preview.length };

    await this.prisma.$transaction(async (tx) => {
      for (const row of preview as any[]) {
        let categoriaId: number | null = null;
        if (row.categoria) {
          const cats = await tx.$queryRawUnsafe<{ id: number }[]>(
            `SELECT id FROM fvs_categorias_servico WHERE tenant_id IN (0, $1) AND LOWER(nome) = LOWER($2) LIMIT 1`,
            tenantId,
            row.categoria,
          );
          if (cats.length) categoriaId = cats[0].id;
        }
        const srvRows = await tx.$queryRawUnsafe<{ id: number }[]>(
          `INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, norma_referencia)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          tenantId, categoriaId, row.codigo, row.nome, row.norma,
        );
        if (row.item_descricao && srvRows[0]) {
          await tx.$queryRawUnsafe(
            `INSERT INTO fvs_catalogo_itens
               (tenant_id, servico_id, descricao, criterio_aceite, tolerancia, metodo_verificacao,
                criticidade, foto_modo, foto_minimo, foto_maximo, ordem)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            tenantId,
            srvRows[0].id,
            row.item_descricao,
            row.criterio_aceite    || null,
            row.tolerancia         || null,
            row.metodo_verificacao || null,
            row.criticidade || 'menor',
            row.foto_modo   || 'opcional',
            0,
            2,
            0,
          );
        }
      }
    });
    return { preview, errors: [], total: preview.length };
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  private async _insertItem(
    tenantId: number,
    servicoId: number,
    dto: CreateItemDto,
    ordemOverride?: number,
  ): Promise<FvsItem> {
    const rows = await this.prisma.$queryRawUnsafe<FvsItem[]>(
      `INSERT INTO fvs_catalogo_itens
         (tenant_id, servico_id, descricao, criterio_aceite, tolerancia, metodo_verificacao,
          criticidade, foto_modo, foto_minimo, foto_maximo, ordem, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      tenantId,
      servicoId,
      dto.descricao,
      dto.criterioAceite    ?? null,
      dto.tolerancia        ?? null,
      dto.metodoVerificacao ?? null,
      dto.criticidade ?? 'menor',
      dto.fotoModo    ?? 'opcional',
      dto.fotoMinimo  ?? 0,
      dto.fotoMaximo  ?? 2,
      ordemOverride ?? dto.ordem ?? 0,
      dto.ativo ?? true,
    );
    return rows[0];
  }
}
