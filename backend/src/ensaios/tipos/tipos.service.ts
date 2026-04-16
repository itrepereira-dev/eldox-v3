// backend/src/ensaios/tipos/tipos.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateTipoDto } from './dto/create-tipo.dto';
import type { UpdateTipoDto } from './dto/update-tipo.dto';

export interface EnsaioTipoComFrequencia {
  id: number;
  tenant_id: number;
  nome: string;
  unidade: string;
  valor_ref_min: number | null;
  valor_ref_max: number | null;
  norma_tecnica: string | null;
  material_tipo: string | null;
  fvm_material_id: number | null;
  aprovacao_manual: boolean;
  ativo: boolean;
  criado_por: number;
  created_at: Date;
  updated_at: Date;
  freq_id: number | null;
  unidade_frequencia: string | null;
  freq_valor: number | null;
}

// 5 tipos padrão NBR/GEO para novos tenants
const TIPOS_PADRAO = [
  { nome: 'Resistência de Bloco', unidade: 'MPa', valor_ref_min: 4.0,  norma_tecnica: 'NBR 6136:2016', material_tipo: 'bloco_concreto' },
  { nome: 'Compressão de Bloco',  unidade: 'MPa', valor_ref_min: 4.0,  norma_tecnica: 'NBR 6136:2016', material_tipo: 'bloco_concreto' },
  { nome: 'Prisma Cheio',         unidade: 'MPa', valor_ref_min: 3.0,  norma_tecnica: 'NBR 15961-1',   material_tipo: 'bloco_concreto' },
  { nome: 'Prisma Vazio',         unidade: 'MPa', valor_ref_min: 3.0,  norma_tecnica: 'NBR 15961-1',   material_tipo: 'bloco_concreto' },
  { nome: 'Graute',               unidade: 'MPa', valor_ref_min: 20.0, norma_tecnica: 'NBR 15961-1',   material_tipo: 'bloco_concreto' },
] as const;

@Injectable()
export class TiposService {
  private readonly logger = new Logger(TiposService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private computeAprovacaoManual(min: number | null | undefined, max: number | null | undefined): boolean {
    return (min == null && max == null);
  }

  private async getTipoOuFalhar(tenantId: number, id: number): Promise<EnsaioTipoComFrequencia> {
    const rows = await this.prisma.$queryRawUnsafe<EnsaioTipoComFrequencia[]>(
      `SELECT t.*,
              f.id          AS freq_id,
              f.unidade_frequencia,
              f.valor       AS freq_valor
       FROM ensaio_tipo t
       LEFT JOIN ensaio_frequencia f ON f.ensaio_tipo_id = t.id AND f.tenant_id = t.tenant_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Tipo de ensaio ${id} não encontrado`);
    return rows[0];
  }

  private auditLog(
    tenantId: number,
    userId: number,
    acao: string,
    entidadeId: number,
    detalhes: object,
  ): void {
    this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, detalhes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      tenantId, userId, acao, 'ensaio_tipo', entidadeId, JSON.stringify(detalhes),
    ).catch(() => {
      this.logger.error(JSON.stringify({
        audit: true, tenant_id: tenantId, usuario_id: userId,
        acao, entidade: 'ensaio_tipo', entidade_id: entidadeId, detalhes,
      }));
    });
  }

  // ── GET /tipos ─────────────────────────────────────────────────────────────

  async listarTipos(
    tenantId: number,
    ativo: boolean | undefined,
    material_tipo?: string,
  ): Promise<EnsaioTipoComFrequencia[]> {
    const conditions: string[] = ['t.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (ativo !== undefined) {
      conditions.push(`t.ativo = $${i++}`);
      params.push(ativo);
    }

    if (material_tipo) {
      conditions.push(`t.material_tipo = $${i++}`);
      params.push(material_tipo);
    }

    return this.prisma.$queryRawUnsafe<EnsaioTipoComFrequencia[]>(
      `SELECT t.*,
              f.id          AS freq_id,
              f.unidade_frequencia,
              f.valor       AS freq_valor
       FROM ensaio_tipo t
       LEFT JOIN ensaio_frequencia f ON f.ensaio_tipo_id = t.id AND f.tenant_id = t.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.nome ASC`,
      ...params,
    );
  }

  // ── POST /tipos ────────────────────────────────────────────────────────────

  async criarTipo(tenantId: number, userId: number, dto: CreateTipoDto): Promise<EnsaioTipoComFrequencia> {
    // Validação de intervalo de referência
    if (
      dto.valor_ref_min != null &&
      dto.valor_ref_max != null &&
      dto.valor_ref_min > dto.valor_ref_max
    ) {
      throw new BadRequestException('valor_ref_min não pode ser maior que valor_ref_max');
    }

    // Verificar duplicidade de nome no tenant
    const existe = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ensaio_tipo WHERE tenant_id = $1 AND nome = $2`,
      tenantId, dto.nome,
    );
    if (existe.length) {
      throw new ConflictException(`Já existe um tipo de ensaio com o nome "${dto.nome}" neste tenant`);
    }

    const aprovacaoManual = this.computeAprovacaoManual(dto.valor_ref_min, dto.valor_ref_max);

    // INSERT dentro de $transaction para garantir atomicidade com frequência
    const result = await this.prisma.$transaction(async (tx) => {
      const tipoRows = await tx.$queryRawUnsafe<EnsaioTipoComFrequencia[]>(
        `INSERT INTO ensaio_tipo
           (tenant_id, nome, unidade, valor_ref_min, valor_ref_max, norma_tecnica,
            material_tipo, fvm_material_id, aprovacao_manual, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        tenantId,
        dto.nome,
        dto.unidade,
        dto.valor_ref_min ?? null,
        dto.valor_ref_max ?? null,
        dto.norma_tecnica ?? null,
        dto.material_tipo ?? null,
        dto.fvm_material_id ?? null,
        aprovacaoManual,
        userId,
      );
      const tipo = tipoRows[0];

      let freqRow: { id: number; unidade_frequencia: string; valor: number } | null = null;
      if (dto.frequencia) {
        const fRows = await tx.$queryRawUnsafe<{ id: number; unidade_frequencia: string; valor: number }[]>(
          `INSERT INTO ensaio_frequencia (tenant_id, ensaio_tipo_id, unidade_frequencia, valor)
           VALUES ($1, $2, $3, $4)
           RETURNING id, unidade_frequencia, valor`,
          tenantId, tipo.id, dto.frequencia.unidade_frequencia, dto.frequencia.valor,
        );
        freqRow = fRows[0];
      }

      return {
        ...tipo,
        freq_id: freqRow?.id ?? null,
        unidade_frequencia: freqRow?.unidade_frequencia ?? null,
        freq_valor: freqRow?.valor ?? null,
      } as EnsaioTipoComFrequencia;
    });

    this.auditLog(tenantId, userId, 'ensaio_tipo.criar', result.id, { nome: dto.nome });
    return result;
  }

  // ── PATCH /tipos/:id ───────────────────────────────────────────────────────

  async atualizarTipo(
    tenantId: number,
    userId: number,
    id: number,
    dto: UpdateTipoDto,
  ): Promise<EnsaioTipoComFrequencia> {
    // Garantir que o registro pertence ao tenant
    const atual = await this.getTipoOuFalhar(tenantId, id);

    // Determinar os novos valores de min/max para recalcular aprovacao_manual
    const novoMin = 'valor_ref_min' in dto ? dto.valor_ref_min : atual.valor_ref_min;
    const novoMax = 'valor_ref_max' in dto ? dto.valor_ref_max : atual.valor_ref_max;

    if (novoMin != null && novoMax != null && novoMin > novoMax) {
      throw new BadRequestException('valor_ref_min não pode ser maior que valor_ref_max');
    }

    // Verificar conflito de nome se nome está sendo alterado
    if (dto.nome && dto.nome !== atual.nome) {
      const existe = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM ensaio_tipo WHERE tenant_id = $1 AND nome = $2 AND id != $3`,
        tenantId, dto.nome, id,
      );
      if (existe.length) {
        throw new ConflictException(`Já existe um tipo de ensaio com o nome "${dto.nome}" neste tenant`);
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const fields: [keyof UpdateTipoDto, string][] = [
      ['nome', 'nome'],
      ['unidade', 'unidade'],
      ['norma_tecnica', 'norma_tecnica'],
      ['material_tipo', 'material_tipo'],
      ['fvm_material_id', 'fvm_material_id'],
    ];

    for (const [key, col] of fields) {
      if (dto[key] !== undefined) {
        sets.push(`${col} = $${i++}`);
        vals.push(dto[key] ?? null);
      }
    }

    // valor_ref_min e valor_ref_max: podem ser explicitamente null
    if ('valor_ref_min' in dto) { sets.push(`valor_ref_min = $${i++}`); vals.push(dto.valor_ref_min ?? null); }
    if ('valor_ref_max' in dto) { sets.push(`valor_ref_max = $${i++}`); vals.push(dto.valor_ref_max ?? null); }

    // Recalcular aprovacao_manual se algum dos valores de referência mudou
    const recalcAprovacao = 'valor_ref_min' in dto || 'valor_ref_max' in dto;
    if (recalcAprovacao) {
      sets.push(`aprovacao_manual = $${i++}`);
      vals.push(this.computeAprovacaoManual(novoMin, novoMax));
    }

    if (!sets.length && !dto.frequencia) {
      return atual;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let tipoAtualizado = atual;

      if (sets.length) {
        sets.push(`updated_at = NOW()`);
        vals.push(id, tenantId);

        const rows = await tx.$queryRawUnsafe<EnsaioTipoComFrequencia[]>(
          `UPDATE ensaio_tipo SET ${sets.join(', ')}
           WHERE id = $${i++} AND tenant_id = $${i++}
           RETURNING *`,
          ...vals,
        );
        if (!rows.length) throw new NotFoundException(`Tipo de ensaio ${id} não encontrado`);
        tipoAtualizado = { ...rows[0], freq_id: atual.freq_id, unidade_frequencia: atual.unidade_frequencia, freq_valor: atual.freq_valor };
      }

      if (dto.frequencia) {
        // Upsert na tabela de frequência
        const fRows = await tx.$queryRawUnsafe<{ id: number; unidade_frequencia: string; valor: number }[]>(
          `INSERT INTO ensaio_frequencia (tenant_id, ensaio_tipo_id, unidade_frequencia, valor)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, ensaio_tipo_id)
           DO UPDATE SET unidade_frequencia = EXCLUDED.unidade_frequencia,
                         valor = EXCLUDED.valor
           RETURNING id, unidade_frequencia, valor`,
          tenantId, id, dto.frequencia.unidade_frequencia, dto.frequencia.valor,
        );
        tipoAtualizado = {
          ...tipoAtualizado,
          freq_id: fRows[0].id,
          unidade_frequencia: fRows[0].unidade_frequencia,
          freq_valor: fRows[0].valor,
        };
      }

      return tipoAtualizado;
    });

    this.auditLog(tenantId, userId, 'ensaio_tipo.atualizar', id, { campos: Object.keys(dto) });
    return result;
  }

  // ── PATCH /tipos/:id/toggle-ativo ──────────────────────────────────────────

  async toggleAtivo(
    tenantId: number,
    userId: number,
    id: number,
  ): Promise<{ id: number; nome: string; ativo: boolean }> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number; nome: string; ativo: boolean }[]>(
      `UPDATE ensaio_tipo
       SET ativo = NOT ativo, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, nome, ativo`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Tipo de ensaio ${id} não encontrado`);
    this.auditLog(tenantId, userId, 'ensaio_tipo.toggle_ativo', id, { ativo: rows[0].ativo });
    return rows[0];
  }

  // ── DELETE /tipos/:id ──────────────────────────────────────────────────────

  async deletarTipo(tenantId: number, userId: number, id: number): Promise<void> {
    await this.getTipoOuFalhar(tenantId, id);

    // Verificar uso em ensaio_laboratorial (tabela pode não existir ainda)
    let emUso = 0;
    try {
      const usadoRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
        `SELECT COUNT(*)::int AS total FROM ensaio_laboratorial
         WHERE ensaio_tipo_id = $1 AND tenant_id = $2`,
        id, tenantId,
      );
      emUso = Number(usadoRows[0]?.total ?? 0);
    } catch {
      // Tabela ensaio_laboratorial ainda não existe — ignorar
    }

    if (emUso > 0) {
      throw new ConflictException(
        `Tipo em uso em ${emUso} ensaio(s). Use desativação.`,
      );
    }

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM ensaio_tipo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );

    this.auditLog(tenantId, userId, 'ensaio_tipo.deletar', id, {});
  }

  // ── Seed de tipos padrão ───────────────────────────────────────────────────

  async seedTiposPadrao(tenantId: number, userId: number): Promise<{ inseridos: number }> {
    let inseridos = 0;

    for (const tipo of TIPOS_PADRAO) {
      const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO ensaio_tipo
           (tenant_id, nome, unidade, valor_ref_min, valor_ref_max,
            norma_tecnica, material_tipo, aprovacao_manual, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (tenant_id, nome) DO NOTHING
         RETURNING id`,
        tenantId,
        tipo.nome,
        tipo.unidade,
        tipo.valor_ref_min,
        null,            // valor_ref_max não definido → aprovacao_manual = false (min definido)
        tipo.norma_tecnica,
        tipo.material_tipo,
        false,           // valor_ref_min está definido → aprovacao_manual = false
        userId,
      );
      if (rows.length) {
        inseridos++;
        this.auditLog(tenantId, userId, 'ensaio_tipo.seed', rows[0].id, { nome: tipo.nome });
      }
    }

    return { inseridos };
  }
}
