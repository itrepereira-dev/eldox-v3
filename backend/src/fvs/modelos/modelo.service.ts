// backend/src/fvs/modelos/modelo.service.ts
import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FvsModelo, FvsModeloServico, ObraModeloFvs } from '../types/fvs.types';
import type { CreateModeloDto } from './dto/create-modelo.dto';
import type { UpdateModeloDto } from './dto/update-modelo.dto';
import type { CreateModeloServicoDto } from './dto/create-modelo-servico.dto';
import type { UpdateModeloServicoDto } from './dto/update-modelo-servico.dto';

@Injectable()
export class ModeloService {
  private readonly logger = new Logger(ModeloService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helper ─────────────────────────────────────────────────────────────────

  private async getModeloOuFalhar(tenantId: number, modeloId: number): Promise<FvsModelo> {
    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `SELECT * FROM fvs_modelos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      modeloId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Template ${modeloId} não encontrado`);
    return rows[0];
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async createModelo(tenantId: number, userId: number, dto: CreateModeloDto): Promise<FvsModelo> {
    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `INSERT INTO fvs_modelos
         (tenant_id, nome, descricao, escopo, obra_id, regime,
          exige_ro, exige_reinspecao, exige_parecer, fotos_obrigatorias, fotos_itens_ids, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      tenantId, dto.nome, dto.descricao,
      dto.escopo, dto.escopo === 'obra' ? (dto.obraId ?? null) : null,
      dto.regime,
      dto.exigeRo    ?? true,
      dto.exigeReinspecao ?? true,
      dto.exigeParecer    ?? true,
      dto.fotosObrigatorias ?? 'apenas_nc',
      dto.fotosItensIds?.length ? dto.fotosItensIds : null,
      userId,
    );
    return rows[0];
  }

  async getModelos(
    tenantId: number,
    filters: { escopo?: string; status?: string; bloqueado?: boolean } = {},
  ): Promise<FvsModelo[]> {
    const conditions: string[] = ['(tenant_id = $1 OR tenant_id = 0)', 'deleted_at IS NULL'];
    const vals: unknown[] = [tenantId];
    let i = 2;
    if (filters.escopo) { conditions.push(`escopo = $${i++}`); vals.push(filters.escopo); }
    if (filters.status) { conditions.push(`status = $${i++}`); vals.push(filters.status); }
    if (filters.bloqueado !== undefined) { conditions.push(`bloqueado = $${i++}`); vals.push(filters.bloqueado); }

    return this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `SELECT m.*,
              (SELECT COUNT(*) FROM obra_modelo_fvs omf WHERE omf.modelo_id = m.id AND omf.deleted_at IS NULL)::int AS obras_count
       FROM fvs_modelos m
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.nome ASC`,
      ...vals,
    );
  }

  async getModelo(tenantId: number, modeloId: number): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    const servicos = await this.prisma.$queryRawUnsafe<FvsModeloServico[]>(
      `SELECT ms.*, s.nome AS servico_nome
       FROM fvs_modelo_servicos ms
       JOIN fvs_catalogo_servicos s ON s.id = ms.servico_id
       WHERE ms.modelo_id = $1 AND ms.tenant_id = $2
       ORDER BY ms.ordem ASC`,
      modeloId, tenantId,
    );
    return { ...modelo, servicos };
  }

  async updateModelo(tenantId: number, modeloId: number, dto: UpdateModeloDto): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.bloqueado) throw new ForbiddenException('Template bloqueado não pode ser editado. Use duplicar.');
    if (modelo.status !== 'rascunho') throw new ConflictException('Apenas templates em rascunho podem ser editados.');

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (dto.nome            !== undefined) { sets.push(`nome = $${i++}`);             vals.push(dto.nome); }
    if (dto.descricao       !== undefined) { sets.push(`descricao = $${i++}`);        vals.push(dto.descricao); }
    if (dto.escopo          !== undefined) { sets.push(`escopo = $${i++}`);           vals.push(dto.escopo); }
    if (dto.obraId          !== undefined) { sets.push(`obra_id = $${i++}`);          vals.push(dto.obraId); }
    if (dto.regime          !== undefined) { sets.push(`regime = $${i++}`);           vals.push(dto.regime); }
    if (dto.exigeRo            !== undefined) { sets.push(`exige_ro = $${i++}`);             vals.push(dto.exigeRo); }
    if (dto.exigeReinspecao    !== undefined) { sets.push(`exige_reinspecao = $${i++}`);     vals.push(dto.exigeReinspecao); }
    if (dto.exigeParecer       !== undefined) { sets.push(`exige_parecer = $${i++}`);        vals.push(dto.exigeParecer); }
    if (dto.fotosObrigatorias  !== undefined) { sets.push(`fotos_obrigatorias = $${i++}`);   vals.push(dto.fotosObrigatorias); }
    if (dto.fotosItensIds      !== undefined) { sets.push(`fotos_itens_ids = $${i++}`);       vals.push(dto.fotosItensIds?.length ? dto.fotosItensIds : null); }

    if (!sets.length) return modelo;

    const idIdx = i++;
    const tenantIdx = i++;
    vals.push(modeloId, tenantId);

    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `UPDATE fvs_modelos SET ${sets.join(', ')} WHERE id = $${idIdx} AND tenant_id = $${tenantIdx} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteModelo(tenantId: number, modeloId: number): Promise<void> {
    await this.getModeloOuFalhar(tenantId, modeloId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_modelos SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      modeloId, tenantId,
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async concluirModelo(tenantId: number, modeloId: number, userId: number): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.status !== 'rascunho') {
      throw new ConflictException(`Template já está ${modelo.status}`);
    }

    const servicos = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM fvs_modelo_servicos WHERE modelo_id = $1 AND tenant_id = $2`,
      modeloId, tenantId,
    );
    if (!servicos.length) {
      throw new UnprocessableEntityException('Template precisa de pelo menos 1 serviço para ser concluído');
    }

    // IMPORTANT: params order is (userId, modeloId, tenantId) → $1=userId, $2=modeloId, $3=tenantId
    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `UPDATE fvs_modelos
       SET status = 'concluido', concluido_por = $1, concluido_em = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      userId, modeloId, tenantId,
    );
    return rows[0];
  }

  async reabrirModelo(tenantId: number, modeloId: number): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.bloqueado) throw new ForbiddenException('Template bloqueado (já foi usado em fichas). Use duplicar.');
    if (modelo.status !== 'concluido') throw new ConflictException('Apenas templates concluídos podem ser reabertos');

    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `UPDATE fvs_modelos
       SET status = 'rascunho', concluido_por = NULL, concluido_em = NULL
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      modeloId, tenantId,
    );
    return rows[0];
  }

  async duplicarModelo(tenantId: number, modeloId: number, userId: number): Promise<FvsModelo> {
    return this.prisma.$transaction(async (tx) => {
      const original = await this.getModeloOuFalhar(tenantId, modeloId);
      const servicos = await tx.$queryRawUnsafe<FvsModeloServico[]>(
        `SELECT * FROM fvs_modelo_servicos WHERE modelo_id = $1 AND tenant_id = $2`,
        modeloId, tenantId,
      );

      const novoRows = await tx.$queryRawUnsafe<FvsModelo[]>(
        `INSERT INTO fvs_modelos
           (tenant_id, nome, descricao, versao, escopo, obra_id, regime,
            exige_ro, exige_reinspecao, exige_parecer, criado_por)
         VALUES ($1, $2, $3, $4, 'empresa', NULL, $5, $6, $7, $8, $9)
         RETURNING *`,
        tenantId,
        `${original.nome} (cópia)`,
        original.descricao,
        original.versao + 1,
        original.regime,
        original.exige_ro,
        original.exige_reinspecao,
        original.exige_parecer,
        userId,
      );
      const novoModelo = novoRows[0];

      for (const svc of servicos) {
        await tx.$executeRawUnsafe(
          `INSERT INTO fvs_modelo_servicos (tenant_id, modelo_id, servico_id, ordem, itens_excluidos)
           VALUES ($1, $2, $3, $4, $5)`,
          tenantId, novoModelo.id, svc.servico_id, svc.ordem,
          svc.itens_excluidos?.length ? svc.itens_excluidos : null,
        );
      }

      return novoModelo;
    });
  }

  // ── Vinculação Obra ────────────────────────────────────────────────────────

  async vincularObras(
    tenantId: number,
    modeloId: number,
    obraIds: number[],
    userId: number,
  ): Promise<void> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.status !== 'concluido') {
      throw new ConflictException('Apenas templates concluídos podem ser vinculados a obras');
    }

    if (modelo.escopo === 'obra') {
      const obraIdsInvalidos = obraIds.filter(id => id !== modelo.obra_id);
      if (obraIdsInvalidos.length) {
        throw new ConflictException(
          `Template de escopo 'obra' só pode ser vinculado à obra ${modelo.obra_id}`,
        );
      }
    }

    for (const obraId of obraIds) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO obra_modelo_fvs (tenant_id, obra_id, modelo_id, vinculado_por)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (obra_id, modelo_id) DO UPDATE SET deleted_at = NULL`,
        tenantId, obraId, modeloId, userId,
      );
    }
  }

  async desvincularObra(tenantId: number, modeloId: number, obraId: number): Promise<void> {
    await this.getModeloOuFalhar(tenantId, modeloId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE obra_modelo_fvs SET deleted_at = NOW()
       WHERE obra_id = $1 AND modelo_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      obraId, modeloId, tenantId,
    );
  }

  async getObrasByModelo(tenantId: number, modeloId: number): Promise<ObraModeloFvs[]> {
    await this.getModeloOuFalhar(tenantId, modeloId);
    return this.prisma.$queryRawUnsafe<ObraModeloFvs[]>(
      `SELECT omf.*, o.nome AS obra_nome
       FROM obra_modelo_fvs omf
       JOIN "Obra" o ON o.id = omf.obra_id
       WHERE omf.modelo_id = $1 AND omf.tenant_id = $2 AND omf.deleted_at IS NULL
       ORDER BY omf.created_at DESC`,
      modeloId, tenantId,
    );
  }

  async getModelosByObra(tenantId: number, obraId: number): Promise<ObraModeloFvs[]> {
    return this.prisma.$queryRawUnsafe<ObraModeloFvs[]>(
      `SELECT omf.*, m.nome AS modelo_nome
       FROM obra_modelo_fvs omf
       JOIN fvs_modelos m ON m.id = omf.modelo_id
       WHERE omf.obra_id = $1 AND omf.tenant_id = $2 AND omf.deleted_at IS NULL
         AND m.status = 'concluido' AND m.deleted_at IS NULL
       ORDER BY m.nome ASC`,
      obraId, tenantId,
    );
  }

  // ── Serviços do template ───────────────────────────────────────────────────

  private async assertModeloEditavel(tenantId: number, modeloId: number): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.bloqueado) throw new ForbiddenException('Template bloqueado não pode ser editado');
    if (modelo.status !== 'rascunho') throw new ForbiddenException('Apenas templates em rascunho podem ter serviços alterados');
    return modelo;
  }

  async addServicoModelo(
    tenantId: number,
    modeloId: number,
    dto: CreateModeloServicoDto,
  ): Promise<FvsModeloServico> {
    await this.assertModeloEditavel(tenantId, modeloId);
    const rows = await this.prisma.$queryRawUnsafe<FvsModeloServico[]>(
      `INSERT INTO fvs_modelo_servicos (tenant_id, modelo_id, servico_id, ordem, itens_excluidos, item_fotos)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      tenantId, modeloId, dto.servicoId, dto.ordem ?? 0,
      dto.itensExcluidos?.length ? dto.itensExcluidos : null,
      JSON.stringify(dto.itemFotos ?? {}),
    );
    return rows[0];
  }

  async updateServicoModelo(
    tenantId: number,
    modeloId: number,
    servicoId: number,
    dto: UpdateModeloServicoDto,
  ): Promise<FvsModeloServico> {
    await this.assertModeloEditavel(tenantId, modeloId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.ordem           !== undefined) { sets.push(`ordem = $${i++}`);                vals.push(dto.ordem); }
    if (dto.itensExcluidos  !== undefined) { sets.push(`itens_excluidos = $${i++}`);      vals.push(dto.itensExcluidos?.length ? dto.itensExcluidos : null); }
    if (dto.itemFotos       !== undefined) { sets.push(`item_fotos = $${i++}::jsonb`);    vals.push(JSON.stringify(dto.itemFotos)); }
    if (!sets.length) throw new UnprocessableEntityException('Nada para atualizar');
    const midx = i++; const tidx = i++; const sidx = i++;
    vals.push(modeloId, tenantId, servicoId);
    const rows = await this.prisma.$queryRawUnsafe<FvsModeloServico[]>(
      `UPDATE fvs_modelo_servicos SET ${sets.join(', ')} WHERE modelo_id = $${midx} AND tenant_id = $${tidx} AND servico_id = $${sidx} RETURNING *`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException('Serviço não encontrado no template');
    return rows[0];
  }

  async deleteServicoModelo(tenantId: number, modeloId: number, servicoId: number): Promise<void> {
    await this.assertModeloEditavel(tenantId, modeloId);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvs_modelo_servicos WHERE modelo_id = $1 AND tenant_id = $2 AND servico_id = $3`,
      modeloId, tenantId, servicoId,
    );
  }

  // ── Used by InspecaoService.createFicha ─────────────────────────────────────

  async getModeloParaFicha(
    tx: any,
    tenantId: number,
    modeloId: number,
  ): Promise<{ modelo: FvsModelo; servicos: FvsModeloServico[] }> {
    const rows = (await tx.$queryRawUnsafe(
      `SELECT * FROM fvs_modelos WHERE id = $1 AND (tenant_id = $2 OR tenant_id = 0) AND deleted_at IS NULL`,
      modeloId, tenantId,
    )) as FvsModelo[];
    if (!rows.length) throw new NotFoundException(`Template ${modeloId} não encontrado`);
    const modelo = rows[0];
    if (modelo.status !== 'concluido') {
      throw new ConflictException('Apenas templates concluídos podem ser usados para criar Fichas');
    }

    const servicos = (await tx.$queryRawUnsafe(
      `SELECT * FROM fvs_modelo_servicos WHERE modelo_id = $1 AND (tenant_id = $2 OR tenant_id = 0) ORDER BY ordem ASC`,
      modeloId, tenantId,
    )) as FvsModeloServico[];

    // Bloquear template se ainda não bloqueado (1ª vez) — não bloquear templates de sistema
    if (!modelo.is_sistema) {
      await tx.$executeRawUnsafe(
        `UPDATE fvs_modelos SET bloqueado = true WHERE id = $1 AND tenant_id = $2 AND bloqueado = false`,
        modeloId, tenantId,
      );
    }

    return { modelo, servicos };
  }

  async incrementFichasCount(tx: any, tenantId: number, modeloId: number, obraId: number): Promise<void> {
    await tx.$executeRawUnsafe(
      `UPDATE obra_modelo_fvs SET fichas_count = fichas_count + 1
       WHERE obra_id = $1 AND modelo_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      obraId, modeloId, tenantId,
    );
  }
}
