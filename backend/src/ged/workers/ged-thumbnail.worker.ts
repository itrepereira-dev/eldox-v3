// src/ged/workers/ged-thumbnail.worker.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../storage/minio.service';

interface ThumbnailJobData {
  versaoId: number;
  tenantId: number;
}

interface VersaoThumbRow {
  id: number;
  storage_key: string;
  mime_type: string;
  thumbnail_storage_key: string | null;
}

const THUMB_WIDTH = 400;
const THUMB_HEIGHT = 400;
const THUMB_MIME = 'image/jpeg';
const THUMB_QUALITY = 82;

@Processor('ged')
export class GedThumbnailWorker {
  private readonly logger = new Logger(GedThumbnailWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  @Process('ged.thumbnail')
  async handle(job: Job<ThumbnailJobData>): Promise<void> {
    const { versaoId, tenantId } = job.data;

    this.logger.log(`[THUMB] Iniciando job versaoId=${versaoId} tenantId=${tenantId}`);

    const rows = await this.prisma.$queryRawUnsafe<VersaoThumbRow[]>(
      `SELECT v.id, v.storage_key, v.mime_type, v.thumbnail_storage_key
       FROM ged_versoes v
       JOIN ged_documentos d ON d.id = v.documento_id
       WHERE v.id = $1 AND d.tenant_id = $2`,
      versaoId,
      tenantId,
    );

    if (!rows.length) {
      this.logger.warn(`[THUMB] Versão ${versaoId} não encontrada (tenant=${tenantId}). Job ignorado.`);
      return;
    }

    const versao = rows[0];

    // Idempotência — se já existe thumbnail, nada a fazer. Evita retrabalho em
    // reenvios acidentais e em retries pós-falha em etapa posterior.
    if (versao.thumbnail_storage_key) {
      this.logger.log(`[THUMB] Thumbnail já existe para versaoId=${versaoId}. Skip.`);
      return;
    }

    if (!versao.mime_type?.startsWith('image/')) {
      this.logger.log(
        `[THUMB] Mime não é imagem (${versao.mime_type}) para versaoId=${versaoId}. Skip.`,
      );
      return;
    }

    try {
      const originalBuffer = await this.minioService.getFileBuffer(versao.storage_key);

      // contain com fundo branco — mantém proporção, sem corte. Converte
      // para JPEG por ser o formato mais universal e com melhor razão
      // tamanho/qualidade para miniaturas. Ignora alpha (flatten com branco).
      const thumbBuffer = await sharp(originalBuffer)
        .resize(THUMB_WIDTH, THUMB_HEIGHT, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: THUMB_QUALITY })
        .toBuffer();

      // Derivação determinística da key: append de `.thumb.jpg`. Assim, ao
      // remover o original, a rotina de limpeza sabe onde está a thumb sem
      // precisar consultar o banco.
      const thumbKey = `${versao.storage_key}.thumb.jpg`;

      await this.minioService.uploadFile(thumbBuffer, thumbKey, THUMB_MIME);

      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes SET thumbnail_storage_key = $1 WHERE id = $2`,
        thumbKey,
        versaoId,
      );

      this.logger.log(
        `[THUMB] Thumbnail gerado: versaoId=${versaoId} key=${thumbKey} bytes=${thumbBuffer.length}`,
      );
    } catch (err) {
      this.logger.error(`[THUMB] Erro no processamento: versaoId=${versaoId}`, err);
      throw err; // Bull faz retry com backoff
    }
  }
}
