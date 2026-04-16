// backend/src/fvm/recebimento/recebimento.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  FvmGrade, FvmLote, FvmLotePreview, FvmRegistro, FvmItemComRegistro,
} from '../types/fvm.types';
import type { CreateLoteDto } from './dto/create-lote.dto';
import type { PutRegistroDto } from './dto/put-registro.dto';
import type { ConcluirInspecaoDto } from './dto/concluir-inspecao.dto';
import type { LiberarQuarentenaDto } from './dto/liberar-quarentena.dto';

// Transições válidas de status
const TRANSICOES_VALIDAS: Record<string, string[]> = {
  aguardando_inspecao: ['em_inspecao', 'cancelado'],
  em_inspecao: ['aprovado', 'aprovado_com_ressalva', 'quarentena', 'reprovado', 'cancelado'],
  quarentena: ['aprovado', 'aprovado_com_ressalva', 'reprovado'],
  aprovado: [],
  aprovado_com_ressalva: [],
  reprovado: [],
  cancelado: [],
};

@Injectable()
export class RecebimentoService {
  private readonly logger = new Logger(RecebimentoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Grade ──────────────────────────────────────────────────────────────────

  async getGrade(
    tenantId: number,
    obraId: number,
    opts?: { categoriaId?: number; fornecedorId?: number; status?: string },
  ): Promise<FvmGrade> {
    // 1. Materiais que têm ao menos 1 lote nesta obra
    const conditions = ['l.obra_id = $2', 'l.tenant_id = $1', 'l.deleted_at IS NULL'];
    const params: unknown[] = [tenantId, obraId];
    let i = 3;

    if (opts?.categoriaId) { conditions.push(`m.categoria_id = $${i++}`); params.push(opts.categoriaId); }
    if (opts?.fornecedorId) { conditions.push(`l.fornecedor_id = $${i++}`); params.push(opts.fornecedorId); }
    if (opts?.status) { conditions.push(`l.status = $${i++}`); params.push(opts.status); }

    const where = conditions.join(' AND ');

    const materiais = await this.prisma.$queryRawUnsafe<FvmGrade['materiais']>(
      `SELECT DISTINCT m.id, m.nome, m.unidade, m.categoria_id, c.nome AS categoria_nome
       FROM fvm_lotes l
       JOIN fvm_catalogo_materiais m ON m.id = l.material_id
       LEFT JOIN fvm_categorias_materiais c ON c.id = m.categoria_id
       WHERE ${where}
       ORDER BY m.nome ASC`,
      ...params,
    );

    const lotes = await this.prisma.$queryRawUnsafe<FvmGrade['lotes']>(
      `SELECT l.id, l.numero_lote, l.data_entrega::text,
              COALESCE(l.quantidade_nf, l.quantidade_recebida, 0) AS quantidade, l.unidade,
              f.razao_social AS fornecedor_nome
       FROM fvm_lotes l
       JOIN fvm_fornecedores f ON f.id = l.fornecedor_id
       WHERE ${where}
       ORDER BY l.data_entrega ASC, l.id ASC`,
      ...params,
    );

    // 2. Células: materialId → loteId → status
    const celulas_raw = await this.prisma.$queryRawUnsafe<
      { material_id: number; lote_id: number; status: string }[]
    >(
      `SELECT l.material_id, l.id AS lote_id, l.status
       FROM fvm_lotes l
       WHERE ${where}`,
      ...params,
    );

    const celulas: FvmGrade['celulas'] = {};
    for (const row of celulas_raw) {
      if (!celulas[row.material_id]) celulas[row.material_id] = {};
      celulas[row.material_id][row.lote_id] = row.status as any;
    }

    // 3. Resumo
    const resumoRows = await this.prisma.$queryRawUnsafe<{
      total: number; aprovados: number; aprovados_com_ressalva: number;
      quarentena: number; reprovados: number; aguardando: number;
      em_inspecao: number; cancelados: number;
    }[]>(
      `SELECT
         COUNT(*)::int                                              AS total,
         COUNT(*) FILTER (WHERE status = 'aprovado')::int          AS aprovados,
         COUNT(*) FILTER (WHERE status = 'aprovado_com_ressalva')::int AS aprovados_com_ressalva,
         COUNT(*) FILTER (WHERE status = 'quarentena')::int         AS quarentena,
         COUNT(*) FILTER (WHERE status = 'reprovado')::int          AS reprovados,
         COUNT(*) FILTER (WHERE status = 'aguardando_inspecao')::int AS aguardando,
         COUNT(*) FILTER (WHERE status = 'em_inspecao')::int        AS em_inspecao,
         COUNT(*) FILTER (WHERE status = 'cancelado')::int          AS cancelados
       FROM fvm_lotes l
       WHERE ${where}`,
      ...params,
    );

    const r = resumoRows[0];
    return {
      materiais,
      lotes,
      celulas,
      resumo: {
        total_lotes:          r.total,
        aprovados:            r.aprovados,
        aprovados_com_ressalva: r.aprovados_com_ressalva,
        quarentena:           r.quarentena,
        reprovados:           r.reprovados,
        aguardando:           r.aguardando,
        em_inspecao:          r.em_inspecao,
        cancelados:           r.cancelados,
      },
    };
  }

  // ── Lote Preview (para o Drawer) ───────────────────────────────────────────

  async getLotePreview(tenantId: number, loteId: number): Promise<FvmLotePreview> {
    const rows = await this.prisma.$queryRawUnsafe<FvmLote[]>(
      `SELECT l.*, m.nome AS material_nome, f.razao_social AS fornecedor_nome
       FROM fvm_lotes l
       JOIN fvm_catalogo_materiais m ON m.id = l.material_id
       JOIN fvm_fornecedores f ON f.id = l.fornecedor_id
       WHERE l.id = $1 AND l.tenant_id = $2 AND l.deleted_at IS NULL`,
      loteId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Lote ${loteId} não encontrado`);
    const lote = rows[0] as FvmLotePreview;

    // Estatísticas de registros
    const stats = await this.prisma.$queryRawUnsafe<{
      total: number; avaliados: number; nc: number;
    }[]>(
      `SELECT
         COUNT(i.id)::int AS total,
         COUNT(r.id)::int AS avaliados,
         COUNT(r.id) FILTER (WHERE r.status = 'nao_conforme')::int AS nc
       FROM fvm_catalogo_itens i
       LEFT JOIN fvm_registros r ON r.item_id = i.id AND r.lote_id = $1
       WHERE i.material_id = $2 AND i.ativo = true`,
      loteId, lote.material_id,
    );
    lote.registros_total    = stats[0].total;
    lote.registros_avaliados = stats[0].avaliados;
    lote.registros_nc        = stats[0].nc;

    // Itens com status do registro
    lote.itens = await this.prisma.$queryRawUnsafe<FvmItemComRegistro[]>(
      `SELECT i.*,
              r.id        AS registro_id,
              r.status    AS registro_status,
              r.observacao AS registro_observacao
       FROM fvm_catalogo_itens i
       LEFT JOIN fvm_registros r ON r.item_id = i.id AND r.lote_id = $1 AND r.tenant_id = $2
       WHERE i.material_id = $3 AND i.ativo = true
       ORDER BY i.criticidade DESC, i.ordem ASC`,
      loteId, tenantId, lote.material_id,
    );

    return lote;
  }

  // ── Lote completo (para FichaLotePage) ────────────────────────────────────

  async getLote(tenantId: number, loteId: number): Promise<FvmLotePreview> {
    return this.getLotePreview(tenantId, loteId);
  }

  // ── Criar Lote ─────────────────────────────────────────────────────────────

  async createLote(
    tenantId: number,
    obraId: number,
    usuarioId: number,
    dto: CreateLoteDto,
  ): Promise<FvmLote> {
    // Valida fornecedor ativo
    const forn = await this.prisma.$queryRawUnsafe<{ situacao: string }[]>(
      `SELECT situacao FROM fvm_fornecedores WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      dto.fornecedor_id, tenantId,
    );
    if (!forn.length) throw new NotFoundException(`Fornecedor ${dto.fornecedor_id} não encontrado`);
    if (['suspenso', 'desqualificado'].includes(forn[0].situacao)) {
      throw new ConflictException(
        `Fornecedor está ${forn[0].situacao} e não pode receber entregas.`,
      );
    }

    // Gera número de lote sequencial
    const seq = await this.prisma.$queryRawUnsafe<{ seq: number }[]>(
      `SELECT COUNT(*)::int + 1 AS seq FROM fvm_lotes WHERE obra_id = $1 AND tenant_id = $2`,
      obraId, tenantId,
    );
    const numeroLote = `LOTE-${obraId}-${String(seq[0].seq).padStart(4, '0')}`;

    const rows = await this.prisma.$queryRawUnsafe<FvmLote[]>(
      `INSERT INTO fvm_lotes
         (tenant_id, obra_id, material_id, fornecedor_id, numero_lote, numero_nf,
          data_entrega, hora_chegada, quantidade_nf, quantidade_recebida, unidade,
          numero_pedido, lote_fabricante, data_fabricacao, validade,
          hora_saida_usina, slump_especificado, slump_medido,
          status, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'aguardando_inspecao',$19)
       RETURNING *`,
      tenantId, obraId,
      dto.material_id, dto.fornecedor_id,
      numeroLote, dto.numero_nf,
      dto.data_entrega,
      dto.hora_chegada ?? null,
      dto.quantidade_nf ?? dto.quantidade,
      dto.quantidade_recebida ?? null,
      dto.unidade,
      dto.numero_pedido ?? null,
      dto.lote_fabricante ?? null,
      dto.data_fabricacao ?? null,
      dto.validade ?? null,
      dto.hora_saida_usina ?? null,
      dto.slump_especificado ?? null,
      dto.slump_medido ?? null,
      usuarioId,
    );
    return rows[0];
  }

  // ── Registrar item (PUT idempotente) ───────────────────────────────────────

  async putRegistro(
    tenantId: number,
    loteId: number,
    usuarioId: number,
    dto: PutRegistroDto,
  ): Promise<FvmRegistro> {
    // Valida: observacao obrigatória quando nao_conforme
    if (dto.status === 'nao_conforme' && !dto.observacao?.trim()) {
      throw new BadRequestException('Observação é obrigatória para itens não conformes.');
    }

    // Inicia lote se ainda aguardando
    const loteRows = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM fvm_lotes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      loteId, tenantId,
    );
    if (!loteRows.length) throw new NotFoundException(`Lote ${loteId} não encontrado`);
    if (loteRows[0].status === 'aguardando_inspecao') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE fvm_lotes SET status = 'em_inspecao', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        loteId, tenantId,
      );
    }

    // Upsert do registro
    const rows = await this.prisma.$queryRawUnsafe<FvmRegistro[]>(
      `INSERT INTO fvm_registros (tenant_id, lote_id, item_id, status, observacao, inspecionado_por, inspecionado_em)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (tenant_id, lote_id, item_id) DO UPDATE SET
         status           = EXCLUDED.status,
         observacao       = EXCLUDED.observacao,
         inspecionado_por = EXCLUDED.inspecionado_por,
         inspecionado_em  = NOW(),
         updated_at       = NOW()
       RETURNING *`,
      tenantId, loteId, dto.item_id,
      dto.status, dto.observacao ?? null, usuarioId,
    );
    return rows[0];
  }

  // ── Concluir inspeção ─────────────────────────────────────────────────────

  async concluirInspecao(
    tenantId: number,
    loteId: number,
    usuarioId: number,
    dto: ConcluirInspecaoDto,
  ): Promise<FvmLote> {
    const loteRows = await this.prisma.$queryRawUnsafe<{ status: string; material_id: number }[]>(
      `SELECT status, material_id FROM fvm_lotes
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      loteId, tenantId,
    );
    if (!loteRows.length) throw new NotFoundException(`Lote ${loteId} não encontrado`);
    const { status: statusAtual, material_id } = loteRows[0];

    if (!TRANSICOES_VALIDAS[statusAtual]?.includes(dto.decisao)) {
      throw new UnprocessableEntityException(
        `Transição inválida: ${statusAtual} → ${dto.decisao}`,
      );
    }

    // Validações adicionais
    if (dto.decisao === 'quarentena') {
      if (!dto.quarentena_motivo?.trim()) {
        throw new BadRequestException('Motivo de quarentena é obrigatório.');
      }
      if (!dto.quarentena_prazo_dias || dto.quarentena_prazo_dias < 1) {
        throw new BadRequestException('Prazo de quarentena (em dias) é obrigatório.');
      }
    }
    if (dto.decisao === 'reprovado' && !dto.observacao_geral?.trim()) {
      throw new BadRequestException('Observação é obrigatória para reprovação.');
    }

    // Verifica se há itens críticos NC ao tentar aprovar
    if (['aprovado', 'aprovado_com_ressalva'].includes(dto.decisao)) {
      const itensNcCriticos = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count
         FROM fvm_registros r
         JOIN fvm_catalogo_itens i ON i.id = r.item_id
         WHERE r.lote_id = $1 AND r.tenant_id = $2
           AND r.status = 'nao_conforme'
           AND i.criticidade = 'critico'`,
        loteId, tenantId,
      );
      if (itensNcCriticos[0].count > 0 && dto.decisao === 'aprovado') {
        throw new UnprocessableEntityException(
          `Há ${itensNcCriticos[0].count} item(ns) crítico(s) não conforme(s). Lote não pode ser aprovado sem ressalva.`,
        );
      }
    }

    // Atualiza lote
    const rows = await this.prisma.$queryRawUnsafe<FvmLote[]>(
      `UPDATE fvm_lotes SET
         status                 = $1,
         inspecionado_por       = $2,
         inspecionado_em        = NOW(),
         observacao_geral       = $3,
         quarentena_motivo      = $4,
         quarentena_prazo_dias  = $5,
         updated_at             = NOW()
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      dto.decisao, usuarioId,
      dto.observacao_geral ?? null,
      dto.quarentena_motivo ?? null,
      dto.quarentena_prazo_dias ?? null,
      loteId, tenantId,
    );

    // Auto-cria NC se reprovado
    if (dto.decisao === 'reprovado') {
      await this._criarNcReprovacao(tenantId, loteId, material_id, usuarioId, dto.observacao_geral!);
    }

    return rows[0];
  }

  // ── Liberar Quarentena ────────────────────────────────────────────────────

  async liberarQuarentena(
    tenantId: number,
    userId: number,
    loteId: number,
    dto: LiberarQuarentenaDto,
  ): Promise<{ id: number; status: string; quarentena_liberada_em: Date; quarentena_liberada_por: number }> {
    // 1. Busca lote com tenant_id
    const loteRows = await this.prisma.$queryRawUnsafe<{ id: number; status: string }[]>(
      `SELECT id, status FROM fvm_lotes
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      loteId, tenantId,
    );
    if (!loteRows.length) throw new NotFoundException(`Lote ${loteId} não encontrado`);

    // 2. Valida que está em quarentena (mensagem genérica — não expõe estado interno)
    if (loteRows[0].status !== 'quarentena') {
      throw new UnprocessableEntityException(
        'Operação não permitida para o estado atual do lote',
      );
    }

    // 3. Valida evidencia_id cross-tenant (mensagem opaca — não confirma existência em outro tenant)
    if (dto.evidencia_id != null) {
      const evidRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM fvm_evidencias WHERE id = $1 AND tenant_id = $2`,
        dto.evidencia_id, tenantId,
      );
      if (!evidRows.length) {
        throw new ForbiddenException('Evidência não encontrada ou sem permissão de acesso');
      }
    }

    // 4. UPDATE fvm_lotes
    const rows = await this.prisma.$queryRawUnsafe<{
      id: number; status: string; quarentena_liberada_em: Date; quarentena_liberada_por: number;
    }[]>(
      `UPDATE fvm_lotes SET
         status                    = $1,
         quarentena_liberada_por   = $2,
         quarentena_liberada_em    = NOW(),
         quarentena_evidencia_id   = $3,
         updated_at                = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING id, status, quarentena_liberada_em, quarentena_liberada_por`,
      dto.decisao, userId,
      dto.evidencia_id ?? null,
      loteId, tenantId,
    );

    // 5. Ação nas NCs do lote
    if (dto.decisao === 'aprovado' || dto.decisao === 'aprovado_com_ressalva') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE fvm_nao_conformidades SET
           status         = 'encerrada',
           resultado_final = 'aprovado',
           encerrada_em   = NOW(),
           encerrada_por  = $1
         WHERE lote_id = $2 AND tenant_id = $3
           AND status NOT IN ('encerrada', 'cancelada')`,
        userId, loteId, tenantId,
      );
    } else {
      // reprovado
      await this.prisma.$executeRawUnsafe(
        `UPDATE fvm_nao_conformidades SET
           status        = 'em_tratamento',
           acao_imediata = 'devolucao'
         WHERE lote_id = $1 AND tenant_id = $2
           AND status NOT IN ('encerrada', 'cancelada')`,
        loteId, tenantId,
      );
    }

    // 6. Audit log durável (INSERT em banco — equivalente ao padrão do módulo evidencias)
    this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, detalhes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      tenantId, userId, 'FVM_LIBERAR_QUARENTENA', 'fvm_lotes', loteId,
      JSON.stringify({ decisao: dto.decisao, observacao: dto.observacao, evidencia_id: dto.evidencia_id ?? null }),
    ).catch(() => {
      this.logger.log(JSON.stringify({
        audit: true, tenant_id: tenantId, usuario_id: userId,
        acao: 'FVM_LIBERAR_QUARENTENA', entidade: 'fvm_lotes', entidade_id: loteId,
        detalhes: { decisao: dto.decisao }, ts: new Date().toISOString(),
      }));
    });

    // 7. Retorna campos relevantes
    return rows[0];
  }

  // ── NC automática ao reprovar ─────────────────────────────────────────────

  private async _criarNcReprovacao(
    tenantId: number,
    loteId: number,
    materialId: number,
    usuarioId: number,
    descricao: string,
  ): Promise<void> {
    // Busca fornecedor e obra do lote
    const loteRows = await this.prisma.$queryRawUnsafe<{
      fornecedor_id: number; obra_id: number;
    }[]>(
      `SELECT fornecedor_id, obra_id FROM fvm_lotes WHERE id = $1 AND tenant_id = $2`,
      loteId, tenantId,
    );
    if (!loteRows.length) return;
    const { fornecedor_id, obra_id } = loteRows[0];

    // Gera número da NC
    const seqGlobal = await this.prisma.$queryRawUnsafe<{ seq: number }[]>(
      `SELECT COUNT(*)::int + 1 AS seq FROM fvm_nao_conformidades WHERE tenant_id = $1`,
      tenantId,
    );
    const numero = `NC-MAT-${obra_id}-${String(seqGlobal[0].seq).padStart(3, '0')}`;

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO fvm_nao_conformidades
         (tenant_id, lote_id, fornecedor_id, numero, tipo, criticidade,
          descricao, acao_imediata, criado_por)
       VALUES ($1,$2,$3,$4,'visual','critico',$5,'devolucao',$6)
       ON CONFLICT DO NOTHING`,
      tenantId, loteId, fornecedor_id, numero, descricao, usuarioId,
    );
  }
}
