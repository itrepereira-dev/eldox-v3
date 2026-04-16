// backend/src/almoxarifado/nfe/nfe.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { parseWebhookPayload, extractTenantIdFromPayload } from './webhook.adapter';
import type { AlmNotaFiscal, AlmNfeItem } from '../types/alm.types';
import type {
  AceitarNfeDto,
  RejeitarNfeDto,
  VincularOcDto,
  ConfirmarMatchDto,
} from './dto/aceitar-nfe.dto';

@Injectable()
export class NfeService {
  private readonly logger = new Logger(NfeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('almoxarifado') private readonly queue: Queue,
  ) {}

  // ── Webhook receiver ──────────────────────────────────────────────────────

  /**
   * Recebe o payload bruto do webhook (qualquer formato), persiste e enfileira job.
   * Idempotente pela chave_nfe — duplicatas são ignoradas silenciosamente.
   */
  async receberWebhook(
    raw: Record<string, unknown>,
  ): Promise<{ status: 'aceito' | 'duplicado' }> {
    // Tenta extrair a chave antes de persistir — falha rápido se payload inválido
    let chave_nfe: string;
    try {
      const parsed = parseWebhookPayload(raw);
      chave_nfe = parsed.chave_nfe;
    } catch (err: any) {
      throw new BadRequestException(`Payload inválido: ${err.message}`);
    }

    // Idempotência — ignora duplicata
    const existing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_nfe_webhooks WHERE chave_nfe = $1`,
      chave_nfe,
    );
    if (existing.length) {
      this.logger.log(`Webhook duplicado ignorado: chave=${chave_nfe}`);
      return { status: 'duplicado' };
    }

    const tenantId = extractTenantIdFromPayload(raw);

    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO alm_nfe_webhooks (tenant_id, chave_nfe, payload_raw, status)
       VALUES ($1, $2, $3::jsonb, 'pendente')
       RETURNING id`,
      tenantId, chave_nfe, JSON.stringify(raw),
    );
    const webhookId = rows[0].id;

    await this.queue.add('processar-nfe', { webhookId }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 15_000 },
    });

    this.logger.log(JSON.stringify({ action: 'alm.nfe.webhook.recebido', chave_nfe, webhookId }));
    return { status: 'aceito' };
  }

  // ── Processar webhook (chamado pelo job) ──────────────────────────────────

  async processarWebhook(webhookId: number): Promise<void> {
    const webhooks = await this.prisma.$queryRawUnsafe<{
      id: number; payload_raw: Record<string, unknown>; chave_nfe: string; tenant_id: number | null;
    }[]>(
      `SELECT id, payload_raw, chave_nfe, tenant_id FROM alm_nfe_webhooks WHERE id = $1`,
      webhookId,
    );
    if (!webhooks.length) return;
    const wh = webhooks[0];

    // Marca como processando
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_nfe_webhooks SET status = 'processando', tentativas = tentativas + 1, updated_at = NOW()
       WHERE id = $1`,
      webhookId,
    );

    try {
      const parsed = parseWebhookPayload(wh.payload_raw);

      await this.prisma.$transaction(async (tx) => {
        // Cria NF-e
        const nfeRows = await tx.$queryRawUnsafe<{ id: number }[]>(
          `INSERT INTO alm_notas_fiscais
             (tenant_id, webhook_id, chave_nfe, numero, serie,
              emitente_cnpj, emitente_nome, data_emissao, valor_total, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendente_match')
           ON CONFLICT (tenant_id, chave_nfe) DO NOTHING
           RETURNING id`,
          wh.tenant_id, webhookId, parsed.chave_nfe, parsed.numero, parsed.serie,
          parsed.emitente_cnpj, parsed.emitente_nome, parsed.data_emissao,
          parsed.valor_total,
        );

        if (!nfeRows.length) return; // já existia

        const nfeId = nfeRows[0].id;

        // Cria itens
        for (const item of parsed.itens) {
          await tx.$executeRawUnsafe(
            `INSERT INTO alm_nfe_itens
               (nfe_id, xprod, ncm, cfop, unidade_nfe, quantidade, valor_unitario, valor_total, match_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendente')`,
            nfeId, item.xprod, item.ncm, item.cfop, item.unidade_nfe,
            item.quantidade, item.valor_unitario, item.valor_total,
          );
        }

        // Enfileira match IA
        await this.queue.add('match-nfe-itens', { nfeId, tenantId: wh.tenant_id }, {
          delay: 2_000, // aguarda 2s para o INSERT propagar
        });
      });

      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_nfe_webhooks SET status = 'processado', updated_at = NOW() WHERE id = $1`,
        webhookId,
      );

    } catch (err: any) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_nfe_webhooks SET status = 'erro', erro_msg = $2, updated_at = NOW() WHERE id = $1`,
        webhookId, String(err.message),
      );
      throw err;
    }
  }

  // ── Listar NF-es ──────────────────────────────────────────────────────────

  async listar(
    tenantId: number,
    filters: { obraId?: number; status?: string; limit?: number; offset?: number } = {},
  ): Promise<AlmNotaFiscal[]> {
    const limit  = filters.limit  ?? 50;
    const offset = filters.offset ?? 0;
    const conds: string[] = [`nf.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.obraId) { conds.push(`nf.obra_id = $${i++}`);  params.push(filters.obraId); }
    if (filters.status) { conds.push(`nf.status  = $${i++}`);  params.push(filters.status); }

    return this.prisma.$queryRawUnsafe<AlmNotaFiscal[]>(
      `SELECT nf.*,
              oc.numero            AS oc_numero,
              u.nome               AS aceito_por_nome,
              COUNT(it.id)::int    AS total_itens
       FROM alm_notas_fiscais nf
       LEFT JOIN alm_ordens_compra oc ON oc.id = nf.oc_id
       LEFT JOIN "Usuario" u ON u.id = nf.aceito_por
       LEFT JOIN alm_nfe_itens it ON it.nfe_id = nf.id
       WHERE ${conds.join(' AND ')}
       GROUP BY nf.id, oc.numero, u.nome
       ORDER BY nf.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      ...params, limit, offset,
    );
  }

  // ── Detalhe ───────────────────────────────────────────────────────────────

  async buscarOuFalhar(tenantId: number, id: number): Promise<AlmNotaFiscal> {
    const rows = await this.prisma.$queryRawUnsafe<AlmNotaFiscal[]>(
      `SELECT nf.*, oc.numero AS oc_numero, u.nome AS aceito_por_nome
       FROM alm_notas_fiscais nf
       LEFT JOIN alm_ordens_compra oc ON oc.id = nf.oc_id
       LEFT JOIN "Usuario" u ON u.id = nf.aceito_por
       WHERE nf.id = $1 AND nf.tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`NF-e ${id} não encontrada`);

    const itens = await this.prisma.$queryRawUnsafe<AlmNfeItem[]>(
      `SELECT it.*, m.nome AS catalogo_nome
       FROM alm_nfe_itens it
       LEFT JOIN fvm_catalogo_materiais m ON m.id = it.catalogo_id
       WHERE it.nfe_id = $1
       ORDER BY it.id`,
      id,
    );

    return { ...rows[0], itens };
  }

  // ── Vincular a OC ─────────────────────────────────────────────────────────

  async vincularOc(tenantId: number, nfeId: number, dto: VincularOcDto): Promise<void> {
    await this._checkNfe(tenantId, nfeId);
    // Verifica que a OC pertence ao mesmo tenant
    const ocRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_ordens_compra WHERE id = $1 AND tenant_id = $2`,
      dto.oc_id, tenantId,
    );
    if (!ocRows.length) throw new NotFoundException(`OC ${dto.oc_id} não encontrada`);

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_notas_fiscais SET oc_id = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      dto.oc_id, nfeId, tenantId,
    );
  }

  // ── Aceitar NF-e ──────────────────────────────────────────────────────────

  async aceitar(tenantId: number, nfeId: number, usuarioId: number, dto: AceitarNfeDto): Promise<void> {
    const nfe = await this._checkNfe(tenantId, nfeId);
    if (nfe.status === 'aceita' || nfe.status === 'rejeitada') {
      throw new BadRequestException(`NF-e já está "${nfe.status}"`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.oc_id) {
        await tx.$executeRawUnsafe(
          `UPDATE alm_notas_fiscais SET oc_id = $1 WHERE id = $2 AND tenant_id = $3`,
          dto.oc_id, nfeId, tenantId,
        );
      }
      await tx.$executeRawUnsafe(
        `UPDATE alm_notas_fiscais
         SET status = 'aceita', aceito_por = $1, aceito_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        usuarioId, nfeId, tenantId,
      );
    });

    this.logger.log(JSON.stringify({ action: 'alm.nfe.aceitar', tenantId, nfeId, usuarioId }));
  }

  // ── Rejeitar NF-e ────────────────────────────────────────────────────────

  async rejeitar(tenantId: number, nfeId: number, usuarioId: number, dto: RejeitarNfeDto): Promise<void> {
    const nfe = await this._checkNfe(tenantId, nfeId);
    if (nfe.status === 'aceita' || nfe.status === 'rejeitada') {
      throw new BadRequestException(`NF-e já está "${nfe.status}"`);
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_notas_fiscais
       SET status = 'rejeitada', aceito_por = $1, aceito_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      usuarioId, nfeId, tenantId,
    );
  }

  // ── Confirmar match de item ───────────────────────────────────────────────

  async confirmarMatch(
    tenantId: number,
    nfeId: number,
    itemId: number,
    usuarioId: number,
    dto: ConfirmarMatchDto,
  ): Promise<void> {
    await this._checkNfe(tenantId, nfeId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_nfe_itens
       SET catalogo_id = $1, match_status = 'confirmado_manual',
           confirmado_por = $2, confirmado_at = NOW()
       WHERE id = $3 AND nfe_id = $4`,
      dto.catalogo_id, usuarioId, itemId, nfeId,
    );
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  private async _checkNfe(
    tenantId: number,
    id: number,
  ): Promise<{ status: string }> {
    const rows = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM alm_notas_fiscais WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`NF-e ${id} não encontrada`);
    return rows[0];
  }
}
