// src/ged/workers/ged-ocr.worker.ts
//
// Worker de OCR/Extração de texto do GED.
//
// Responsabilidade: dado um upload recém-gravado (fila `ged.ocr`),
// baixa o arquivo do MinIO e extrai o texto pra popular `ged_versoes.ocr_texto`.
//
// Estratégia por formato:
//   - PDF           → pdf-parse (texto nativo, rápido, sem custo IA)
//   - JPG/PNG       → Claude Vision (transcrição de texto de imagem)
//   - DWG/DXF/IFC   → pulado (binário CAD — requer PyMuPDF/AutoCAD server)
//   - DOCX/XLSX etc → pulado por enquanto
//
// Depois da extração, enfileira `ged.classify` pra pipeline de IA continuar.
//
// Concurrency 1: processar um job por vez pra controlar custo de Claude Vision.

import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../storage/minio.service';
import { IaService } from '../../ia/ia.service';

interface OcrJobData {
  versaoId: number;
  tenantId: number;
}

interface VersaoRow {
  id: number;
  storage_key: string;
  mime_type: string;
  nome_original: string;
  tenant_id: number;
}

// Limites para evitar custo explosivo no Claude
const MAX_TEXTO_CHARS = 50_000; // corta em 50 KB de texto (prompt vai direto p/ classificador)
const MAX_IMAGEM_BYTES = 5 * 1024 * 1024; // 5 MB — acima disso, Claude Vision fica caro e lento

@Processor('ged')
export class GedOcrWorker {
  private readonly logger = new Logger(GedOcrWorker.name);
  private readonly gedQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly ia: IaService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @InjectQueue('ged') gedQueue: any,
  ) {
    this.gedQueue = gedQueue as Queue;
  }

  // concurrency=1: segura o custo com Claude Vision e evita picos
  @Process({ name: 'ged.ocr', concurrency: 1 })
  async handle(job: Job<OcrJobData>): Promise<void> {
    const { versaoId, tenantId } = job.data;
    this.logger.log(`[OCR] Iniciando versaoId=${versaoId} tenant=${tenantId}`);

    // Busca dados da versão
    const rows = await this.prisma.$queryRawUnsafe<VersaoRow[]>(
      `SELECT v.id, v.storage_key, v.mime_type, v.nome_original, v.tenant_id
         FROM ged_versoes v
        WHERE v.id = $1 AND v.tenant_id = $2`,
      versaoId,
      tenantId,
    );
    if (!rows.length) {
      this.logger.warn(`[OCR] versaoId=${versaoId} não encontrada. Job ignorado.`);
      return;
    }
    const versao = rows[0];

    let ocrTexto: string | null = null;
    let metadata: Record<string, unknown> = {
      storage_key: versao.storage_key,
      mime_type: versao.mime_type,
      processado_em: new Date().toISOString(),
    };

    try {
      const buffer = await this.minio.getFileBuffer(versao.storage_key);
      const ext = (versao.nome_original.split('.').pop() ?? '').toLowerCase();
      const mime = versao.mime_type.toLowerCase();

      if (mime === 'application/pdf' || ext === 'pdf') {
        const result = await this.extrairTextoPdf(buffer);
        ocrTexto = result.texto;
        metadata = { ...metadata, estrategia: 'pdf-parse', paginas: result.paginas };
      } else if (
        mime.startsWith('image/') &&
        ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
      ) {
        if (buffer.length > MAX_IMAGEM_BYTES) {
          this.logger.warn(`[OCR] Imagem muito grande (${buffer.length}B) — pulando Vision`);
          metadata = { ...metadata, estrategia: 'skipped', motivo: 'imagem_muito_grande', tamanho_bytes: buffer.length };
        } else {
          const visionResult = await this.extrairTextoImagem(buffer, mime, tenantId);
          ocrTexto = visionResult.texto;
          metadata = {
            ...metadata,
            estrategia: 'claude-vision',
            tokens_in: visionResult.tokensIn,
            tokens_out: visionResult.tokensOut,
            custo_usd: visionResult.custoUsd,
          };
        }
      } else if (['dwg', 'dxf', 'ifc', 'step', 'stp'].includes(ext)) {
        metadata = { ...metadata, estrategia: 'skipped', motivo: 'binario_cad' };
      } else {
        metadata = { ...metadata, estrategia: 'skipped', motivo: `formato_nao_suportado_${ext || mime}` };
      }

      // Trunca se muito grande (evita prompt gigante no classifier)
      if (ocrTexto && ocrTexto.length > MAX_TEXTO_CHARS) {
        metadata = { ...metadata, texto_truncado: true, chars_originais: ocrTexto.length };
        ocrTexto = ocrTexto.slice(0, MAX_TEXTO_CHARS);
      }

      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes
            SET ocr_texto = $1,
                ai_metadata = COALESCE(ai_metadata, '{}'::jsonb) || $2::jsonb
          WHERE id = $3`,
        ocrTexto,
        JSON.stringify({ ocr: metadata }),
        versaoId,
      );

      this.logger.log(
        `[OCR] concluído versaoId=${versaoId} chars=${ocrTexto?.length ?? 0} estrategia=${metadata.estrategia}`,
      );

      // Só enfileira classify se temos texto útil
      if (ocrTexto && ocrTexto.trim().length >= 20) {
        await this.gedQueue.add(
          'ged.classify',
          { versaoId, tenantId },
          { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
        );
        this.logger.log(`[OCR] ged.classify enfileirado para versaoId=${versaoId}`);
      } else {
        this.logger.log(`[OCR] Sem texto suficiente — classify NÃO enfileirado versaoId=${versaoId}`);
      }
    } catch (err) {
      // Fallback robusto: não crasha a fila; grava erro em metadata e segue
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[OCR] Falha no processamento versaoId=${versaoId}: ${msg}`);
      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes
            SET ai_metadata = COALESCE(ai_metadata, '{}'::jsonb) || $1::jsonb
          WHERE id = $2`,
        JSON.stringify({ ocr: { error: msg, processado_em: new Date().toISOString() } }),
        versaoId,
      );
    }
  }

  // ── Extração PDF via pdf-parse ─────────────────────────────────────────────

  private async extrairTextoPdf(buffer: Buffer): Promise<{ texto: string; paginas: number }> {
    // pdf-parse v2 (classe PDFParse)
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as { PDFParse: new (opts: { data: Uint8Array }) => { getText: () => Promise<{ text: string; total: number }>; destroy: () => Promise<void> } };
    const parser = new pdfParse.PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return { texto: (result.text ?? '').trim(), paginas: result.total ?? 0 };
    } finally {
      await parser.destroy().catch(() => { /* noop */ });
    }
  }

  // ── Extração de texto de imagem via Claude Vision ──────────────────────────

  private async extrairTextoImagem(
    buffer: Buffer,
    mimeType: string,
    tenantId: number,
  ): Promise<{ texto: string; tokensIn: number; tokensOut: number; custoUsd: number }> {
    const base64 = buffer.toString('base64');
    // Normaliza o mime pra um dos aceitos pelo SDK Anthropic
    const mt: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
      mimeType === 'image/png'  ? 'image/png'  :
      mimeType === 'image/gif'  ? 'image/gif'  :
      mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';

    const system = `Você é um OCR técnico. Transcreva APENAS o texto visível na imagem, preservando quebras de linha. Não adicione comentários, não descreva a imagem, não traduza. Se não houver texto, responda com string vazia.`;
    const userMsg = 'Transcreva o texto desta imagem.';

    const { text, tokensIn, tokensOut, custoEstimado } = await this.ia.callClaudeWithImageForWorker(
      'claude-sonnet-4-6',
      system,
      userMsg,
      base64,
      mt,
      2000,
      tenantId,
      'ged.ocr',
      60_000,
    );

    this.logger.log(
      `[OCR-VISION] tokensIn=${tokensIn} tokensOut=${tokensOut} custo=$${custoEstimado.toFixed(5)}`,
    );

    return { texto: (text ?? '').trim(), tokensIn, tokensOut, custoUsd: custoEstimado };
  }
}
