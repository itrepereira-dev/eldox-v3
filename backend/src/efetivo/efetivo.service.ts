// backend/src/efetivo/efetivo.service.ts
import {
  Injectable, BadRequestException, ConflictException,
  ForbiddenException, NotFoundException, UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RegistroEfetivo, ItemEfetivo, ListagemEfetivo } from './types/efetivo.types';
import type { CreateRegistroDto } from './dto/create-registro.dto';
import type { PatchItemDto } from './dto/patch-item.dto';
import type { QueryEfetivoDto } from './dto/query-efetivo.dto';

@Injectable()
export class EfetivoService {
  private readonly logger = new Logger(EfetivoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async getRegistroOuFalhar(tenantId: number, id: number): Promise<RegistroEfetivo> {
    const rows = await this.prisma.$queryRawUnsafe<RegistroEfetivo[]>(
      `SELECT * FROM registros_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Registro ${id} não encontrado`);
    return rows[0];
  }

  private async gravarAuditLog(
    tenantId: number, registroId: number, acao: string,
    usuarioId: number, ip: string | null, detalhes?: object,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO efetivo_audit_log (tenant_id, registro_id, acao, usuario_id, ip_origem, detalhes, criado_em)
       VALUES ($1, $2, $3, $4, $5::inet, $6::jsonb, NOW())`,
      tenantId, registroId, acao, usuarioId, ip ?? null,
      detalhes ? JSON.stringify(detalhes) : null,
    );
  }

  // ── createRegistro ──────────────────────────────────────────────────────────

  async createRegistro(
    tenantId: number, userId: number, obraId: number,
    dto: CreateRegistroDto, ip: string,
  ): Promise<RegistroEfetivo & { itens: ItemEfetivo[] }> {
    const dataRegistro = new Date(dto.data);
    dataRegistro.setHours(23, 59, 59);
    if (dataRegistro > new Date()) {
      throw new UnprocessableEntityException('Data de efetivo não pode ser futura.');
    }

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const obra = (await tx.$queryRawUnsafe(
          `SELECT id FROM "Obra" WHERE id = $1 AND "tenantId" = $2 AND ativo = TRUE`,
          obraId, tenantId,
        )) as { id: number }[];
        if (!obra.length) throw new BadRequestException(`Obra ${obraId} não encontrada.`);

        for (const item of dto.itens) {
          const emp = (await tx.$queryRawUnsafe(
            `SELECT id FROM empresas_efetivo WHERE id = $1 AND tenant_id = $2 AND ativa = TRUE`,
            item.empresaId, tenantId,
          )) as { id: number }[];
          if (!emp.length) throw new BadRequestException(`Empresa ${item.empresaId} não encontrada.`);

          const fn = (await tx.$queryRawUnsafe(
            `SELECT id FROM funcoes_efetivo WHERE id = $1 AND tenant_id = $2 AND ativa = TRUE`,
            item.funcaoId, tenantId,
          )) as { id: number }[];
          if (!fn.length) throw new BadRequestException(`Função ${item.funcaoId} não encontrada.`);
        }

        const [registro] = (await tx.$queryRawUnsafe(
          `INSERT INTO registros_efetivo (tenant_id, obra_id, data, turno, criado_por)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          tenantId, obraId, dto.data, dto.turno, userId,
        )) as RegistroEfetivo[];

        const itens: ItemEfetivo[] = [];
        for (const item of dto.itens) {
          const [novoItem] = (await tx.$queryRawUnsafe(
            `INSERT INTO itens_efetivo (tenant_id, registro_efetivo_id, empresa_id, funcao_id, quantidade, observacao)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            tenantId, registro.id, item.empresaId, item.funcaoId, item.quantidade, item.observacao ?? null,
          )) as ItemEfetivo[];
          itens.push(novoItem);
        }

        // Vinculação silenciosa ao RDO
        const rdoRows = (await tx.$queryRawUnsafe(
          `SELECT id FROM rdos WHERE obra_id = $1 AND data::date = $2::date AND tenant_id = $3 LIMIT 1`,
          obraId, dto.data, tenantId,
        )) as { id: number }[];
        if (rdoRows.length) {
          await tx.$executeRawUnsafe(
            `UPDATE registros_efetivo SET rdo_id = $1, atualizado_em = NOW() WHERE id = $2`,
            rdoRows[0].id, registro.id,
          );
          registro.rdo_id = rdoRows[0].id;
        }

        return { ...registro, itens };
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Já existe um registro de efetivo para esta obra, data e turno.');
      }
      throw err;
    }
  }

  // ── getRegistros ────────────────────────────────────────────────────────────

  async getRegistros(tenantId: number, obraId: number, query: QueryEfetivoDto): Promise<ListagemEfetivo> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 30;
    const offset = (page - 1) * limit;

    const whereParts = [`r.tenant_id = $1`, `r.obra_id = $2`];
    const vals: unknown[] = [tenantId, obraId];
    let i = 3;

    if (query.mes)   { whereParts.push(`EXTRACT(MONTH FROM r.data) = $${i++}`); vals.push(query.mes); }
    if (query.ano)   { whereParts.push(`EXTRACT(YEAR  FROM r.data) = $${i++}`); vals.push(query.ano); }
    if (query.turno) { whereParts.push(`r.turno = $${i++}`); vals.push(query.turno); }

    const where = whereParts.join(' AND ');
    const baseVals = [...vals];

    const [countRow] = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM registros_efetivo r WHERE ${where}`,
      ...baseVals,
    );
    const total = parseInt(countRow.count, 10);

    const registros = await this.prisma.$queryRawUnsafe<RegistroEfetivo[]>(
      `SELECT r.* FROM registros_efetivo r WHERE ${where} ORDER BY r.data DESC, r.turno ASC LIMIT $${i++} OFFSET $${i++}`,
      ...vals, limit, offset,
    );

    for (const reg of registros) {
      const itens = await this.prisma.$queryRawUnsafe<ItemEfetivo[]>(
        `SELECT i.*, e.nome AS empresa_nome, f.nome AS funcao_nome
         FROM itens_efetivo i
         JOIN empresas_efetivo e ON e.id = i.empresa_id
         JOIN funcoes_efetivo  f ON f.id = i.funcao_id
         WHERE i.registro_efetivo_id = $1`,
        reg.id,
      );
      (reg as any).itens = itens;
      (reg as any).total_homens_dia = itens.reduce((s, it) => s + it.quantidade, 0);
    }

    const porEmpresa = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT e.id AS empresa_id, e.nome, SUM(i.quantidade)::int AS total_homens_dia
       FROM itens_efetivo i
       JOIN registros_efetivo r ON r.id = i.registro_efetivo_id
       JOIN empresas_efetivo  e ON e.id = i.empresa_id
       WHERE ${where} GROUP BY e.id, e.nome ORDER BY e.nome`,
      ...baseVals,
    );

    const porFuncao = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT f.id AS funcao_id, f.nome, SUM(i.quantidade)::int AS total_homens_dia
       FROM itens_efetivo i
       JOIN registros_efetivo r ON r.id = i.registro_efetivo_id
       JOIN funcoes_efetivo   f ON f.id = i.funcao_id
       WHERE ${where} GROUP BY f.id, f.nome ORDER BY f.nome`,
      ...baseVals,
    );

    const totalHomensDia = porEmpresa.reduce((s: number, e: any) => s + Number(e.total_homens_dia), 0);

    return {
      data: registros,
      meta: { total, page, total_pages: Math.ceil(total / limit) },
      resumo: {
        total_homens_dia: totalHomensDia,
        por_empresa: porEmpresa,
        por_funcao:  porFuncao,
      },
    };
  }

  // ── getRegistro ─────────────────────────────────────────────────────────────

  async getRegistro(tenantId: number, obraId: number, id: number): Promise<RegistroEfetivo & { itens: ItemEfetivo[] }> {
    const registro = await this.getRegistroOuFalhar(tenantId, id);
    if (registro.obra_id !== obraId) throw new NotFoundException(`Registro ${id} não encontrado`);

    const itens = await this.prisma.$queryRawUnsafe<ItemEfetivo[]>(
      `SELECT i.*, e.nome AS empresa_nome, f.nome AS funcao_nome
       FROM itens_efetivo i
       JOIN empresas_efetivo e ON e.id = i.empresa_id
       JOIN funcoes_efetivo  f ON f.id = i.funcao_id
       WHERE i.registro_efetivo_id = $1`,
      id,
    );
    return { ...registro, itens };
  }

  // ── patchItem ───────────────────────────────────────────────────────────────

  async patchItem(
    tenantId: number, obraId: number, registroId: number,
    itemId: number, dto: PatchItemDto, userId: number, ip: string,
  ): Promise<ItemEfetivo> {
    const registro = await this.getRegistroOuFalhar(tenantId, registroId);
    if (registro.obra_id !== obraId) throw new NotFoundException(`Registro ${registroId} não encontrado`);
    if (registro.fechado) throw new ForbiddenException('Registro fechado. Somente o Engenheiro pode reabri-lo.');

    const [item] = await this.prisma.$queryRawUnsafe<ItemEfetivo[]>(
      `SELECT * FROM itens_efetivo WHERE id = $1 AND registro_efetivo_id = $2 AND tenant_id = $3`,
      itemId, registroId, tenantId,
    );
    if (!item) throw new NotFoundException(`Item ${itemId} não encontrado`);

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.quantidade !== undefined) { sets.push(`quantidade = $${i++}`); vals.push(dto.quantidade); }
    if (dto.observacao !== undefined) { sets.push(`observacao = $${i++}`); vals.push(dto.observacao); }
    if (!sets.length) return item;

    vals.push(itemId, tenantId);
    const [updated] = await this.prisma.$queryRawUnsafe<ItemEfetivo[]>(
      `UPDATE itens_efetivo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );

    await this.gravarAuditLog(tenantId, registroId, 'edicao_item', userId, ip, { itemId, changes: dto });
    return updated;
  }

  // ── fecharRegistro ──────────────────────────────────────────────────────────

  async fecharRegistro(tenantId: number, obraId: number, id: number, userId: number, ip: string): Promise<RegistroEfetivo> {
    const registro = await this.getRegistroOuFalhar(tenantId, id);
    if (registro.obra_id !== obraId) throw new NotFoundException(`Registro ${id} não encontrado`);
    if (registro.fechado) throw new ForbiddenException('Registro já está fechado.');

    const [countRow] = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM itens_efetivo WHERE registro_efetivo_id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (parseInt(countRow.count, 10) === 0) {
      throw new UnprocessableEntityException('Registro sem itens não pode ser fechado.');
    }

    const [updated] = await this.prisma.$queryRawUnsafe<RegistroEfetivo[]>(
      `UPDATE registros_efetivo
       SET fechado = TRUE, fechado_por = $1, fechado_em = NOW(), atualizado_em = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      userId, id, tenantId,
    );

    await this.gravarAuditLog(tenantId, id, 'fechamento', userId, ip);
    return updated;
  }

  // ── reabrirRegistro ─────────────────────────────────────────────────────────

  async reabrirRegistro(tenantId: number, obraId: number, id: number, userId: number, ip: string): Promise<RegistroEfetivo> {
    const registro = await this.getRegistroOuFalhar(tenantId, id);
    if (registro.obra_id !== obraId) throw new NotFoundException(`Registro ${id} não encontrado`);

    const [updated] = await this.prisma.$queryRawUnsafe<RegistroEfetivo[]>(
      `UPDATE registros_efetivo
       SET fechado = FALSE, fechado_por = NULL, fechado_em = NULL, atualizado_em = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      id, tenantId,
    );

    await this.gravarAuditLog(tenantId, id, 'reabertura', userId, ip);
    return updated;
  }
}
