// src/ged/workers/ged-ocr.worker.ts
import { Processor, Process, InjectQueue, getQueueToken } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

interface OcrJobData {
  versaoId: number;
  tenantId: number;
}

@Processor('ged')
export class GedOcrWorker {
  private readonly logger = new Logger(GedOcrWorker.name);
  private readonly gedQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @InjectQueue('ged') gedQueue: any,
  ) {
    this.gedQueue = gedQueue as Queue;
  }

  @Process('ged.ocr')
  async handle(job: Job<OcrJobData>): Promise<void> {
    const { versaoId, tenantId } = job.data;

    this.logger.log(`[OCR] Iniciando job versaoId=${versaoId} tenantId=${tenantId}`);

    try {
      // Marca o campo ocr_texto como pendente enquanto o processamento real não é integrado.
      // Future: baixar arquivo do MinIO → extrair texto via Tesseract/Anthropic → UPDATE ocr_texto
      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes
         SET ocr_texto = 'OCR_PENDENTE'
         WHERE id = $1`,
        versaoId,
      );

      this.logger.log(`[OCR] Marcado como OCR_PENDENTE: versaoId=${versaoId}`);

      // Enfileira o job de classificação IA após OCR
      await this.gedQueue.add(
        'ged.classify',
        { versaoId, tenantId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
        },
      );

      this.logger.log(`[OCR] Job ged.classify enfileirado para versaoId=${versaoId}`);
    } catch (err) {
      this.logger.error(`[OCR] Erro no processamento: versaoId=${versaoId}`, err);
      throw err; // Re-throw para Bull marcar como falha e tentar retry
    }
  }
}
