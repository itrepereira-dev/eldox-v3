// backend/src/ncs/ncs.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateNcDto } from './dto/create-nc.dto';
import type { UpdateNcDto } from './dto/update-nc.dto';

// CAT_ABREV map para geração de número
const CAT_ABREV: Record<string, string> = {
  CONCRETAGEM: 'CON',
  FVS: 'FVS',
  FVM: 'FVM',
  ENSAIO: 'ENS',
  GERAL: 'GER',
};

export interface NcFiltros {
  status?: string;
  categoria?: string;
  criticidade?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface NcRow {
  id: number;
  tenant_id: number;
  obra_id: number;
  numero: string;
  categoria: string;
  criticidade: string;
  titulo: string;
  descricao: string | null;
  status: string;
  caminhao_id: number | null;
  cp_id: number | null;
  fvs_ficha_id: number | null;
  fvm_lote_id: number | null;
  ensaio_id: number | null;
  aberta_por: number;
  responsavel_id: number | null;
  prazo: Date | null;
  data_fechamento: Date | null;
  evidencia_url: string | null;
  observacoes: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class NcsService {
  private readonly logger = new Logger(NcsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Listar NCs (por obra ou cross-obra) ────────────────────────────────────

  async listar(
    tenantId: number,
    obraId?: number,
    filtros: NcFiltros = {},
  ) {
    const { status, categoria, criticidade, search, page = 1, limit = 20 } = filtros;
    const offset = (page - 1) * limit;

    const conditions: string[] = [
      'tenant_id = $1',
      'deleted_at IS NULL',
    ];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (obraId) {
      conditions.push(`obra_id = $${idx++}`);
      params.push(obraId);
    }
    if (status) {
      conditions.push(`status = $${idx++}::"NcStatus"`);
      params.push(status);
    }
    if (categoria) {
      conditions.push(`categoria = $${idx++}::"NcCategoria"`);
      params.push(categoria);
    }
    if (criticidade) {
      conditions.push(`criticidade = $${idx++}::"NcCriticidade"`);
      params.push(criticidade);
    }
    if (search) {
      conditions.push(`(titulo ILIKE $${idx} OR numero ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const countRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM nao_conformidades WHERE ${where}`,
      ...params,
    );

    const limitIdx = idx;
    const offsetIdx = idx + 1;

    const rows = await this.prisma.$queryRawUnsafe<NcRow[]>(
      `SELECT * FROM nao_conformidades WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      ...params,
      limit,
      offset,
    );

    return {
      status: 'success',
      data: rows,
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
    };
  }

  // ── Buscar NC por ID ───────────────────────────────────────────────────────

  async buscar(tenantId: number, ncId: number) {
    const rows = await this.prisma.$queryRawUnsafe<NcRow[]>(
      `SELECT * FROM nao_conformidades WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      tenantId,
      ncId,
    );
    if (!rows[0]) throw new NotFoundException(`NC ${ncId} não encontrada`);
    return { status: 'success', data: rows[0] };
  }

  // ── Criar NC manual ────────────────────────────────────────────────────────

  async criar(tenantId: number, userId: number, obraId: number, dto: CreateNcDto) {
    const categoria = dto.categoria ?? 'GERAL';
    const criticidade = dto.criticidade ?? 'MEDIA';

    // Geração de número atômica: usa o id SERIAL como sequência (evita race condition)
    // Insere com número temporário → atualiza com id real após INSERT
    const abrev = CAT_ABREV[categoria] ?? 'GER';

    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO nao_conformidades
         (tenant_id, obra_id, numero, categoria, criticidade, titulo, descricao,
          status, aberta_por, responsavel_id, prazo, observacoes, updated_at)
       VALUES ($1,$2,'TEMP',$3::"NcCategoria",$4::"NcCriticidade",$5,$6,
               'ABERTA'::"NcStatus",$7,$8,$9,$10,NOW())
       RETURNING id`,
      tenantId,
      obraId,
      categoria,
      criticidade,
      dto.titulo,
      dto.descricao ?? null,
      userId,
      dto.responsavel_id ?? null,
      dto.prazo ? new Date(dto.prazo) : null,
      dto.observacoes ?? null,
    );

    const ncId = rows[0].id;
    const numero = `NC-${abrev}-${obraId}-${ncId.toString().padStart(4, '0')}`;

    await this.prisma.$executeRawUnsafe(
      `UPDATE nao_conformidades SET numero = $1 WHERE id = $2`,
      numero,
      ncId,
    );

    this.auditLog(tenantId, userId, 'CREATE', ncId, null, dto).catch((e: unknown) => this.logger.error(`audit CREATE falhou: ${e}`));

    return this.buscar(tenantId, ncId);
  }

  // ── Atualizar NC ───────────────────────────────────────────────────────────

  async atualizar(tenantId: number, ncId: number, userId: number, dto: UpdateNcDto) {
    const nc = await this.getNcOuFalhar(tenantId, ncId);

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [tenantId, ncId];
    let idx = 3;

    if (dto.titulo !== undefined) {
      sets.push(`titulo = $${idx++}`);
      params.push(dto.titulo);
    }
    if (dto.descricao !== undefined) {
      sets.push(`descricao = $${idx++}`);
      params.push(dto.descricao);
    }
    if (dto.categoria !== undefined) {
      sets.push(`categoria = $${idx++}::"NcCategoria"`);
      params.push(dto.categoria);
    }
    if (dto.criticidade !== undefined) {
      sets.push(`criticidade = $${idx++}::"NcCriticidade"`);
      params.push(dto.criticidade);
    }
    if (dto.status !== undefined) {
      sets.push(`status = $${idx++}::"NcStatus"`);
      params.push(dto.status);
      // Marca data de fechamento automaticamente
      if (dto.status === 'FECHADA' || dto.status === 'CANCELADA') {
        sets.push(`data_fechamento = NOW()`);
      }
    }
    if (dto.responsavel_id !== undefined) {
      sets.push(`responsavel_id = $${idx++}`);
      params.push(dto.responsavel_id);
    }
    if (dto.prazo !== undefined) {
      sets.push(`prazo = $${idx++}`);
      params.push(dto.prazo ? new Date(dto.prazo) : null);
    }
    if (dto.evidencia_url !== undefined) {
      sets.push(`evidencia_url = $${idx++}`);
      params.push(dto.evidencia_url);
    }
    if (dto.observacoes !== undefined) {
      sets.push(`observacoes = $${idx++}`);
      params.push(dto.observacoes);
    }
    if (dto.data_fechamento !== undefined) {
      sets.push(`data_fechamento = $${idx++}`);
      params.push(dto.data_fechamento ? new Date(dto.data_fechamento) : null);
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE nao_conformidades SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
      ...params,
    );

    this.auditLog(tenantId, userId, 'UPDATE', ncId, nc, dto).catch((e: unknown) => this.logger.error(`audit UPDATE falhou: ${e}`));

    return this.buscar(tenantId, ncId);
  }

  // ── Soft delete NC ─────────────────────────────────────────────────────────

  async deletar(tenantId: number, ncId: number, userId: number) {
    const nc = await this.getNcOuFalhar(tenantId, ncId);

    if (nc.status !== 'ABERTA' && nc.status !== 'CANCELADA') {
      throw new BadRequestException(
        'Somente NCs com status ABERTA ou CANCELADA podem ser excluídas',
      );
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE nao_conformidades SET deleted_at = NOW(), updated_at = NOW() WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      ncId,
    );

    this.auditLog(tenantId, userId, 'DELETE', ncId, nc, null).catch((e: unknown) => this.logger.error(`audit DELETE falhou: ${e}`));

    return { status: 'success', data: { id: ncId, deleted: true } };
  }

  // ── Helper privado ─────────────────────────────────────────────────────────

  private async getNcOuFalhar(tenantId: number, ncId: number): Promise<NcRow> {
    const rows = await this.prisma.$queryRawUnsafe<NcRow[]>(
      `SELECT * FROM nao_conformidades WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      tenantId,
      ncId,
    );
    if (!rows[0]) throw new NotFoundException(`NC ${ncId} não encontrada`);
    return rows[0];
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
         VALUES ($1, $2, $3, 'nao_conformidade', $4, $5::jsonb, $6::jsonb)`,
        tenantId,
        userId,
        acao,
        entidadeId,
        JSON.stringify(antes),
        JSON.stringify(depois),
      )
      .catch((e: unknown) => this.logger.error(`audit_log NC falhou: ${e}`));
  }
}
