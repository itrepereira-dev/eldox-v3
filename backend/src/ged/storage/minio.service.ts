// src/ged/storage/minio.service.ts
// DEPENDÊNCIA: npm install minio
// Variáveis de ambiente necessárias:
//   MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_USE_SSL

import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

// Tipagem mínima para evitar erro de compilação sem o pacote instalado.
// Após `npm install minio`, remover esta declaração e importar: import * as Minio from 'minio';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MinioClient = any;

export interface MinioUploadResult {
  key: string;
  bucket: string;
  checksum: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: MinioClient;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    // TODO: após npm install minio, substituir por:
    //   import * as Minio from 'minio';
    //   this.client = new Minio.Client({ ... });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Minio = require('minio');

    this.bucket = process.env.MINIO_BUCKET ?? 'eldox-ged';
    this.region = process.env.MINIO_REGION ?? 'us-east-1';

    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? '',
      secretKey: process.env.MINIO_SECRET_KEY ?? '',
    });
  }

  /**
   * Garante que o bucket existe ao subir o módulo. Sem isso, deploys limpos
   * quebravam com NoSuchBucket no primeiro upload (o docker-compose sobe o
   * MinIO vazio e nenhum seed cria o bucket).
   *
   * Fail-fast intencional: se o MinIO está inacessível ou as credenciais
   * estão erradas, o app não deve subir. Descobrir em produção via 500 no
   * upload é pior do que refusar start.
   */
  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (exists) {
        this.logger.log(`MinIO bucket ok: ${this.bucket}`);
        return;
      }
      await this.client.makeBucket(this.bucket, this.region);
      this.logger.log(`MinIO bucket criado: ${this.bucket} (region=${this.region})`);
    } catch (err) {
      this.logger.error(
        `MinIO bootstrap falhou (bucket=${this.bucket}): ${String(err)}`,
      );
      throw err;
    }
  }

  /**
   * Faz upload de um buffer para o MinIO.
   * A storage_key segue o padrão: {tenantId}/{obraId}/{docId}/{filename}
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<MinioUploadResult> {
    const checksum = this.calcularChecksum(buffer);

    const metadata = {
      'Content-Type': mimeType,
      'X-Checksum-SHA256': checksum,
    };

    try {
      await this.client.putObject(this.bucket, key, buffer, buffer.length, metadata);
      this.logger.log(`Upload concluído: ${key} (${buffer.length} bytes)`);
      return { key, bucket: this.bucket, checksum };
    } catch (err) {
      this.logger.error(`Erro no upload MinIO: ${key}`, err);
      throw new InternalServerErrorException('Falha ao armazenar arquivo no storage.');
    }
  }

  /**
   * Gera URL pré-assinada para download seguro.
   * @param key       storage_key do arquivo
   * @param ttlSeconds TTL em segundos (300 = 5 min para downloads, 600 = 10 min para QR)
   */
  async getPresignedUrl(key: string, ttlSeconds: number): Promise<string> {
    try {
      return await this.client.presignedGetObject(this.bucket, key, ttlSeconds);
    } catch (err) {
      this.logger.error(`Erro ao gerar presigned URL: ${key}`, err);
      throw new InternalServerErrorException('Falha ao gerar URL de acesso ao arquivo.');
    }
  }

  /**
   * Remove arquivo do MinIO (usado em cancelamento/limpeza de rascunhos).
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key);
      this.logger.log(`Arquivo removido: ${key}`);
    } catch (err) {
      this.logger.error(`Erro ao remover arquivo MinIO: ${key}`, err);
      throw new InternalServerErrorException('Falha ao remover arquivo do storage.');
    }
  }

  /**
   * Verifica se um objeto existe no bucket.
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Baixa o arquivo do MinIO como Buffer.
   *
   * Usado pelos workers (OCR, Classificador, Thumbnail) que precisam processar
   * o conteúdo do arquivo em memória. Não usa URL pré-assinada — fluxo
   * server-to-server direto, sem expor URL pública.
   *
   * Para arquivos > 100 MB isso aloca muita memória; o worker roda com
   * concurrency 1 e os uploads já estão limitados a 100 MB via Multer.
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    try {
      // minio client retorna um Readable stream via getObject
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream: AsyncIterable<any> = await this.client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        // chunk pode vir como Buffer, Uint8Array ou string dependendo do encoding
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else {
          // Uint8Array / ArrayBuffer / fallback
          chunks.push(Buffer.from(chunk as Uint8Array));
        }
      }
      return Buffer.concat(chunks);
    } catch (err) {
      this.logger.error(`Erro ao baixar arquivo MinIO: ${key}`, err);
      throw new InternalServerErrorException('Falha ao ler arquivo do storage.');
    }
  }

  /**
   * Calcula checksum SHA-256 de um buffer.
   */
  calcularChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Monta a storage_key padrão do GED.
   * Formato para escopo OBRA:    {tenantId}/{obraId}/{documentoId}/{nomeOriginal}
   * Formato para escopo EMPRESA: {tenantId}/EMPRESA/{documentoId}/{nomeOriginal}
   *
   * Quando obraId é null, o documento é corporativo (escopo EMPRESA) — usa o
   * literal "EMPRESA" no lugar do obra_id numérico para manter uma hierarquia
   * clara no bucket (facilita browsing manual e limpeza posterior).
   */
  buildStorageKey(
    tenantId: number,
    obraId: number | null,
    documentoId: number,
    nomeOriginal: string,
  ): string {
    // Sanitiza o nome do arquivo para evitar path traversal
    const nomeSanitizado = nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, '_');
    const scopeSegment = obraId === null ? 'EMPRESA' : String(obraId);
    return `${tenantId}/${scopeSegment}/${documentoId}/${Date.now()}_${nomeSanitizado}`;
  }
}
