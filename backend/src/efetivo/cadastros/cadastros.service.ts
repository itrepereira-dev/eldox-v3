// backend/src/efetivo/cadastros/cadastros.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { EmpresaEfetivo, FuncaoEfetivo } from '../types/efetivo.types';
import type { CreateEmpresaDto } from '../dto/create-empresa.dto';
import type { CreateFuncaoDto } from '../dto/create-funcao.dto';

@Injectable()
export class CadastrosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Empresas ────────────────────────────────────────────────────────────────

  async getEmpresas(tenantId: number): Promise<EmpresaEfetivo[]> {
    return this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `SELECT * FROM empresas_efetivo WHERE tenant_id = $1 ORDER BY nome ASC`,
      tenantId,
    );
  }

  async createEmpresa(tenantId: number, dto: CreateEmpresaDto): Promise<EmpresaEfetivo> {
    const rows = await this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `INSERT INTO empresas_efetivo (tenant_id, nome, tipo, cnpj)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      tenantId,
      dto.nome,
      dto.tipo ?? 'SUBCONTRATADA',
      dto.cnpj ?? null,
    );
    return rows[0];
  }

  async updateEmpresa(
    tenantId: number,
    id: number,
    payload: Partial<Pick<EmpresaEfetivo, 'nome' | 'cnpj' | 'ativa'>>,
  ): Promise<EmpresaEfetivo> {
    const existing = await this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `SELECT * FROM empresas_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!existing.length) throw new NotFoundException(`Empresa ${id} não encontrada`);

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (payload.nome  !== undefined) { sets.push(`nome = $${i++}`);  vals.push(payload.nome); }
    if (payload.cnpj  !== undefined) { sets.push(`cnpj = $${i++}`);  vals.push(payload.cnpj); }
    if (payload.ativa !== undefined) { sets.push(`ativa = $${i++}`); vals.push(payload.ativa); }
    if (!sets.length) return existing[0];

    vals.push(id, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `UPDATE empresas_efetivo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  // ── Funções ─────────────────────────────────────────────────────────────────

  async getFuncoes(tenantId: number): Promise<FuncaoEfetivo[]> {
    return this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `SELECT * FROM funcoes_efetivo WHERE tenant_id = $1 ORDER BY nome ASC`,
      tenantId,
    );
  }

  async createFuncao(tenantId: number, dto: CreateFuncaoDto): Promise<FuncaoEfetivo> {
    const rows = await this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `INSERT INTO funcoes_efetivo (tenant_id, nome)
       VALUES ($1, $2)
       RETURNING *`,
      tenantId,
      dto.nome,
    );
    return rows[0];
  }

  async updateFuncao(
    tenantId: number,
    id: number,
    payload: Partial<Pick<FuncaoEfetivo, 'nome' | 'ativa'>>,
  ): Promise<FuncaoEfetivo> {
    const existing = await this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `SELECT * FROM funcoes_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!existing.length) throw new NotFoundException(`Função ${id} não encontrada`);

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (payload.nome  !== undefined) { sets.push(`nome = $${i++}`);  vals.push(payload.nome); }
    if (payload.ativa !== undefined) { sets.push(`ativa = $${i++}`); vals.push(payload.ativa); }
    if (!sets.length) return existing[0];

    vals.push(id, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `UPDATE funcoes_efetivo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteEmpresa(tenantId: number, id: number): Promise<void> {
    const existing = await this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `SELECT id FROM empresas_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!existing.length) throw new NotFoundException(`Empresa ${id} não encontrada`);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM empresas_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
  }

  async deleteFuncao(tenantId: number, id: number): Promise<void> {
    const existing = await this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `SELECT id FROM funcoes_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!existing.length) throw new NotFoundException(`Função ${id} não encontrada`);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM funcoes_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
  }
}
