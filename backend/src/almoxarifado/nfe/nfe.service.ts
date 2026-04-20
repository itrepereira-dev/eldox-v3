// backend/src/almoxarifado/nfe/nfe.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parseWebhookPayload,
  extractTenantIdFromPayload,
} from './webhook.adapter';
import { parseNfeXmlToJson } from './xml-parser.util';
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

  // ── Upload manual de XML NF-e ─────────────────────────────────────────────

  /**
   * Recebe o conteúdo de um arquivo XML NF-e enviado manualmente pelo
   * usuário (via endpoint autenticado) e persiste no mesmo fluxo do webhook.
   *
   * Diferença relevante: o tenantId vem do JWT do usuário logado,
   * NÃO do payload do XML (que não possui referência a tenant Eldox).
   *
   * Idempotente por chave_nfe: se a NF já foi importada, retorna
   * { status: 'duplicado', nfeId } apontando para o registro existente,
   * para o frontend poder redirecionar para a tela de detalhe.
   */
  async importarXml(
    tenantId: number,
    xmlContent: string,
  ): Promise<{ status: 'aceito' | 'duplicado'; chave_nfe: string; nfeId?: number }> {
    // 1. Parse XML -> JSON
    let raw: Record<string, unknown>;
    try {
      raw = parseNfeXmlToJson(xmlContent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(msg);
    }

    // 2. Extrair chave NF-e + validar payload
    let chave_nfe: string;
    try {
      const parsed = parseWebhookPayload(raw);
      chave_nfe = parsed.chave_nfe;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`NF-e inválida: ${msg}`);
    }

    // 3. Idempotência — se já foi importada, devolve referência
    const existingNfe = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_notas_fiscais WHERE tenant_id = $1 AND chave_nfe = $2`,
      tenantId,
      chave_nfe,
    );
    if (existingNfe.length) {
      this.logger.log(`Upload XML duplicado: chave=${chave_nfe} nfeId=${existingNfe[0].id}`);
      return { status: 'duplicado', chave_nfe, nfeId: existingNfe[0].id };
    }

    // 4. Reutiliza fluxo do webhook: grava em alm_nfe_webhooks e enfileira.
    //    Vantagem: o job `processar-nfe` já cuida do INSERT em notas_fiscais
    //    + itens + match IA. Mantemos um único caminho para processar NF-e.
    const whRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO alm_nfe_webhooks (tenant_id, chave_nfe, payload_raw, status)
       VALUES ($1, $2, $3::jsonb, 'pendente')
       ON CONFLICT (chave_nfe) DO NOTHING
       RETURNING id`,
      tenantId,
      chave_nfe,
      JSON.stringify(raw),
    );

    // Se não retornou id, outro request concorrente já gravou — busca o id existente
    if (!whRows.length) {
      const retry = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM alm_nfe_webhooks WHERE chave_nfe = $1`,
        chave_nfe,
      );
      return { status: 'duplicado', chave_nfe, nfeId: undefined };
    }

    const webhookId = whRows[0].id;

    await this.queue.add(
      'processar-nfe',
      { webhookId },
      { attempts: 5, backoff: { type: 'exponential', delay: 15_000 } },
    );

    this.logger.log(
      JSON.stringify({
        action: 'alm.nfe.xml.importado',
        chave_nfe,
        webhookId,
        tenantId,
      }),
    );

    return { status: 'aceito', chave_nfe };
  }

  /**
   * Processa sincronamente todos os webhooks com status 'pendente' do tenant.
   * Útil como ferramenta admin quando BullMQ estiver indisponível/atrasado ou
   * para re-processar webhooks que falharam.
   *
   * Retorna: { processados: N, falhou: M, detalhe: [{webhookId, status, erro}] }
   */
  async reprocessarWebhooksPendentes(tenantId: number): Promise<{
    processados: number;
    falhou: number;
    detalhe: Array<{ webhookId: number; chave_nfe: string; status: string; erro?: string }>;
  }> {
    const pendentes = await this.prisma.$queryRawUnsafe<
      { id: number; chave_nfe: string }[]
    >(
      `SELECT id, chave_nfe FROM alm_nfe_webhooks
       WHERE tenant_id = $1 AND status IN ('pendente', 'erro')
       ORDER BY created_at ASC
       LIMIT 50`,
      tenantId,
    );

    const detalhe: Array<{ webhookId: number; chave_nfe: string; status: string; erro?: string }> = [];
    let processados = 0;
    let falhou = 0;

    for (const w of pendentes) {
      try {
        await this.processarWebhook(w.id);
        processados++;
        detalhe.push({ webhookId: w.id, chave_nfe: w.chave_nfe, status: 'processado' });
      } catch (err: unknown) {
        falhou++;
        const msg = err instanceof Error ? err.message : String(err);
        detalhe.push({ webhookId: w.id, chave_nfe: w.chave_nfe, status: 'erro', erro: msg });
      }
    }

    this.logger.log(
      JSON.stringify({
        action: 'alm.nfe.reprocessar_pendentes',
        tenantId,
        total: pendentes.length,
        processados,
        falhou,
      }),
    );

    return { processados, falhou, detalhe };
  }

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
      tenantId,
      chave_nfe,
      JSON.stringify(raw),
    );
    const webhookId = rows[0].id;

    await this.queue.add(
      'processar-nfe',
      { webhookId },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 15_000 },
      },
    );

    this.logger.log(
      JSON.stringify({
        action: 'alm.nfe.webhook.recebido',
        chave_nfe,
        webhookId,
      }),
    );
    return { status: 'aceito' };
  }

  // ── Processar webhook (chamado pelo job) ──────────────────────────────────

  async processarWebhook(webhookId: number): Promise<void> {
    const webhooks = await this.prisma.$queryRawUnsafe<
      {
        id: number;
        payload_raw: Record<string, unknown>;
        chave_nfe: string;
        tenant_id: number | null;
      }[]
    >(
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
          wh.tenant_id,
          webhookId,
          parsed.chave_nfe,
          parsed.numero,
          parsed.serie,
          parsed.emitente_cnpj,
          parsed.emitente_nome,
          parsed.data_emissao,
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
            nfeId,
            item.xprod,
            item.ncm,
            item.cfop,
            item.unidade_nfe,
            item.quantidade,
            item.valor_unitario,
            item.valor_total,
          );
        }

        // Enfileira match IA
        await this.queue.add(
          'match-nfe-itens',
          { nfeId, tenantId: wh.tenant_id },
          {
            delay: 2_000, // aguarda 2s para o INSERT propagar
          },
        );
      });

      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_nfe_webhooks SET status = 'processado', updated_at = NOW() WHERE id = $1`,
        webhookId,
      );
    } catch (err: any) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_nfe_webhooks SET status = 'erro', erro_msg = $2, updated_at = NOW() WHERE id = $1`,
        webhookId,
        String(err.message),
      );
      throw err;
    }
  }

  // ── Listar NF-es ──────────────────────────────────────────────────────────

  async listar(
    tenantId: number,
    filters: {
      localId?: number;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<AlmNotaFiscal[]> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const conds: string[] = [`nf.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.localId) {
      conds.push(`nf.local_id = $${i++}`);
      params.push(filters.localId);
    }
    if (filters.status) {
      conds.push(`nf.status  = $${i++}`);
      params.push(filters.status);
    }

    return this.prisma.$queryRawUnsafe<AlmNotaFiscal[]>(
      `SELECT nf.*,
              oc.numero            AS oc_numero,
              u.nome               AS aceito_por_nome,
              l.nome               AS local_nome,
              COUNT(it.id)::int    AS total_itens
       FROM alm_notas_fiscais nf
       LEFT JOIN alm_ordens_compra oc ON oc.id = nf.oc_id
       LEFT JOIN "Usuario" u ON u.id = nf.aceito_por
       LEFT JOIN alm_locais l ON l.id = nf.local_id
       LEFT JOIN alm_nfe_itens it ON it.nfe_id = nf.id
       WHERE ${conds.join(' AND ')}
       GROUP BY nf.id, oc.numero, u.nome, l.nome
       ORDER BY nf.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      ...params,
      limit,
      offset,
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
      id,
      tenantId,
    );
    if (!rows.length) throw new NotFoundException(`NF-e ${id} não encontrada`);

    const itens = await this.prisma.$queryRawUnsafe<AlmNfeItem[]>(
      `SELECT
         it.*,
         m.nome     AS catalogo_nome,
         m.unidade  AS catalogo_unidade_padrao
       FROM alm_nfe_itens it
       LEFT JOIN fvm_catalogo_materiais m ON m.id = it.catalogo_id
       WHERE it.nfe_id = $1
       ORDER BY it.id`,
      id,
    );

    return { ...rows[0], itens };
  }

  // ── Vincular a OC ─────────────────────────────────────────────────────────

  async vincularOc(
    tenantId: number,
    nfeId: number,
    dto: VincularOcDto,
  ): Promise<void> {
    await this._checkNfe(tenantId, nfeId);
    // Verifica que a OC pertence ao mesmo tenant
    const ocRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_ordens_compra WHERE id = $1 AND tenant_id = $2`,
      dto.oc_id,
      tenantId,
    );
    if (!ocRows.length)
      throw new NotFoundException(`OC ${dto.oc_id} não encontrada`);

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_notas_fiscais SET oc_id = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      dto.oc_id,
      nfeId,
      tenantId,
    );
  }

  // ── Aceitar NF-e ──────────────────────────────────────────────────────────

  async aceitar(
    tenantId: number,
    nfeId: number,
    usuarioId: number,
    dto: AceitarNfeDto,
  ): Promise<void> {
    const nfe = await this._checkNfe(tenantId, nfeId);
    if (nfe.status === 'aceita' || nfe.status === 'rejeitada') {
      throw new BadRequestException(`NF-e já está "${nfe.status}"`);
    }

    // Valida que o local existe, pertence ao tenant e está ativo
    const localRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_locais WHERE id = $1 AND tenant_id = $2 AND ativo = true`,
      dto.local_id,
      tenantId,
    );
    if (!localRows.length) {
      throw new NotFoundException(`Local ${dto.local_id} não encontrado ou inativo`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.oc_id) {
        await tx.$executeRawUnsafe(
          `UPDATE alm_notas_fiscais SET oc_id = $1 WHERE id = $2 AND tenant_id = $3`,
          dto.oc_id,
          nfeId,
          tenantId,
        );
      }

      await tx.$executeRawUnsafe(
        `UPDATE alm_notas_fiscais
         SET status = 'aceita', aceito_por = $1, aceito_at = NOW(), updated_at = NOW(), local_id = $4
         WHERE id = $2 AND tenant_id = $3`,
        usuarioId,
        nfeId,
        tenantId,
        dto.local_id,
      );

      // Busca itens com catalogo_id para criar movimentos de entrada
      const itens = await tx.$queryRawUnsafe<
        { id: number; catalogo_id: number; unidade_nfe: string; quantidade: number }[]
      >(
        `SELECT id, catalogo_id, unidade_nfe, quantidade
         FROM alm_nfe_itens
         WHERE nfe_id = $1 AND catalogo_id IS NOT NULL`,
        nfeId,
      );

      for (const item of itens) {
        // Upsert saldo — garante que a linha existe antes de atualizar
        const saldoRows = await tx.$queryRawUnsafe<{ id: number; quantidade: number }[]>(
          `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, quantidade, unidade, updated_at)
           VALUES ($1, $2, $3, 0, $4, NOW())
           ON CONFLICT (tenant_id, local_id, catalogo_id) DO UPDATE SET id = alm_estoque_saldo.id
           RETURNING id, quantidade::float`,
          tenantId,
          dto.local_id,
          item.catalogo_id,
          item.unidade_nfe,
        );
        const saldoAnterior = Number(saldoRows[0].quantidade);
        const saldoPosterior = saldoAnterior + Number(item.quantidade);

        // Atualiza saldo
        await tx.$executeRawUnsafe(
          `UPDATE alm_estoque_saldo SET quantidade = $1, updated_at = NOW() WHERE id = $2`,
          saldoPosterior,
          saldoRows[0].id,
        );

        // Registra movimento de entrada
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_movimentos
             (tenant_id, catalogo_id, local_id, tipo, quantidade, unidade,
              saldo_anterior, saldo_posterior, referencia_tipo, referencia_id, criado_por, created_at)
           VALUES ($1,$2,$3,'entrada',$4,$5,$6,$7,'nfe',$8,$9,NOW())`,
          tenantId,
          item.catalogo_id,
          dto.local_id,
          item.quantidade,
          item.unidade_nfe,
          saldoAnterior,
          saldoPosterior,
          nfeId,
          usuarioId,
        );
      }
    });

    this.logger.log(
      JSON.stringify({ action: 'alm.nfe.aceitar', tenantId, nfeId, usuarioId, localId: dto.local_id }),
    );
  }

  // ── Rejeitar NF-e ────────────────────────────────────────────────────────

  async rejeitar(
    tenantId: number,
    nfeId: number,
    usuarioId: number,
    dto: RejeitarNfeDto,
  ): Promise<void> {
    const nfe = await this._checkNfe(tenantId, nfeId);
    if (nfe.status === 'aceita' || nfe.status === 'rejeitada') {
      throw new BadRequestException(`NF-e já está "${nfe.status}"`);
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_notas_fiscais
       SET status = 'rejeitada', aceito_por = $1, aceito_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      usuarioId,
      nfeId,
      tenantId,
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
      dto.catalogo_id,
      usuarioId,
      itemId,
      nfeId,
    );
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  private async _checkNfe(
    tenantId: number,
    id: number,
  ): Promise<{ status: string }> {
    const rows = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM alm_notas_fiscais WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
    if (!rows.length) throw new NotFoundException(`NF-e ${id} não encontrada`);
    return rows[0];
  }
}
