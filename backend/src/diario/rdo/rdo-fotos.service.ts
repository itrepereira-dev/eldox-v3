// backend/src/diario/rdo/rdo-fotos.service.ts
// Sprint B1 — Upload/listagem/exclusão de fotos do RDO via MinIO
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Minio = require('minio');

const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const TAMANHO_MAX = 20 * 1024 * 1024; // 20 MB por foto

export interface FotoRow {
  id: number;
  rdo_id: number;
  tenant_id: number;
  url: string;
  thumbnail_url: string | null;
  nome_arquivo: string;
  tamanho_bytes: number;
  upload_por: number;
  created_at: Date;
  legenda: string | null;
}

@Injectable()
export class RdoFotosService {
  private readonly logger = new Logger(RdoFotosService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Upload de foto ───────────────────────────────────────────────────────

  async uploadFoto(
    tenantId: number,
    rdoId: number,
    usuarioId: number,
    base64: string,
    mimeType: string,
    legenda?: string,
  ): Promise<FotoRow> {
    // 1. Validar MIME type
    const ext = MIME_PERMITIDOS[mimeType];
    if (!ext) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${mimeType}. Use JPEG, PNG, WebP ou HEIC.`,
      );
    }

    // 2. Decodificar base64
    const buffer = Buffer.from(base64, 'base64');

    // 3. Validar tamanho
    if (buffer.length > TAMANHO_MAX) {
      throw new BadRequestException(
        `Arquivo muito grande (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Máximo: 20 MB.`,
      );
    }

    // 4. Verificar se RDO existe e pertence ao tenant
    const rdoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, status FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      rdoId,
      tenantId,
    );
    if (!rdoRows.length) {
      throw new NotFoundException(`RDO ${rdoId} não encontrado`);
    }
    if (rdoRows[0].status === 'aprovado') {
      throw new ForbiddenException('Não é possível adicionar fotos a um RDO aprovado');
    }

    // 5. Gerar nome único
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).slice(2, 10);
    const nomeArquivo = `rdo-${rdoId}-${timestamp}-${randomHex}.${ext}`;
    const storagePath = `rdo-fotos/tenant-${tenantId}/rdo-${rdoId}/${nomeArquivo}`;

    // 6. Upload para MinIO
    const url = await this.uploadMinio(buffer, storagePath, mimeType);

    // 7. Gerar thumbnail (reduz para 400px de largura se necessário)
    let thumbnailUrl: string | null = null;
    try {
      thumbnailUrl = await this.gerarThumbnail(buffer, tenantId, rdoId, nomeArquivo, ext);
    } catch (err) {
      this.logger.warn(`Thumbnail falhou para RDO ${rdoId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 8. Persistir no banco
    const rows = await this.prisma.$queryRawUnsafe<FotoRow[]>(
      `INSERT INTO rdo_fotos
         (rdo_id, tenant_id, url, thumbnail_url, nome_arquivo, tamanho_bytes, upload_por, legenda)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      rdoId,
      tenantId,
      url,
      thumbnailUrl,
      nomeArquivo,
      buffer.length,
      usuarioId,
      legenda ?? null,
    );

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'rdo.foto.upload.ok',
        rdo_id: rdoId,
        tenant_id: tenantId,
        nome: nomeArquivo,
        bytes: buffer.length,
      }),
    );

    return rows[0];
  }

  // ─── Listar fotos ─────────────────────────────────────────────────────────

  async listar(tenantId: number, rdoId: number): Promise<FotoRow[]> {
    // Verificar que RDO pertence ao tenant
    const rdoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      rdoId,
      tenantId,
    );
    if (!rdoRows.length) {
      throw new NotFoundException(`RDO ${rdoId} não encontrado`);
    }

    return this.prisma.$queryRawUnsafe<FotoRow[]>(
      `SELECT * FROM rdo_fotos WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
      rdoId,
      tenantId,
    );
  }

  // ─── Excluir foto ─────────────────────────────────────────────────────────

  async excluir(tenantId: number, rdoId: number, fotoId: number, usuarioId: number): Promise<void> {
    // Verificar se foto existe e pertence ao tenant/RDO
    const rows = await this.prisma.$queryRawUnsafe<FotoRow[]>(
      `SELECT * FROM rdo_fotos WHERE id = $1 AND rdo_id = $2 AND tenant_id = $3`,
      fotoId,
      rdoId,
      tenantId,
    );
    if (!rows.length) {
      throw new NotFoundException(`Foto ${fotoId} não encontrada`);
    }

    // Verificar que RDO não está aprovado
    const rdoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT status FROM rdos WHERE id = $1 AND tenant_id = $2`,
      rdoId,
      tenantId,
    );
    if (rdoRows[0]?.status === 'aprovado') {
      throw new ForbiddenException('Não é possível excluir fotos de um RDO aprovado');
    }

    const foto = rows[0];

    // Excluir do MinIO (opcional — não falha o fluxo)
    await this.excluirMinio(foto.url);
    if (foto.thumbnail_url) {
      await this.excluirMinio(foto.thumbnail_url);
    }

    // Excluir do banco
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM rdo_fotos WHERE id = $1 AND tenant_id = $2`,
      fotoId,
      tenantId,
    );

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'rdo.foto.excluir.ok',
        foto_id: fotoId,
        rdo_id: rdoId,
        tenant_id: tenantId,
        usuario_id: usuarioId,
      }),
    );
  }

  // ─── MinIO helpers ────────────────────────────────────────────────────────

  private getMinioClient() {
    return new Minio.Client({
      endPoint:  process.env.MINIO_ENDPOINT  ?? 'localhost',
      port:      parseInt(process.env.MINIO_PORT ?? '9000', 10),
      useSSL:    process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? '',
      secretKey: process.env.MINIO_SECRET_KEY ?? '',
    });
  }

  private async uploadMinio(buffer: Buffer, objectPath: string, mimeType: string): Promise<string> {
    const client = this.getMinioClient();
    const bucket = process.env.MINIO_BUCKET ?? 'eldox-ged';

    await client.putObject(bucket, objectPath, buffer, buffer.length, {
      'Content-Type': mimeType,
    });

    // URL pública ou presigned — usa MINIO_PUBLIC_URL se disponível
    const publicBase = process.env.MINIO_PUBLIC_URL;
    if (publicBase) {
      return `${publicBase.replace(/\/$/, '')}/${bucket}/${objectPath}`;
    }

    // Fallback: presigned URL com 7 dias de validade
    return client.presignedGetObject(bucket, objectPath, 7 * 24 * 3600);
  }

  private async excluirMinio(urlOuPath: string): Promise<void> {
    try {
      const client = this.getMinioClient();
      const bucket = process.env.MINIO_BUCKET ?? 'eldox-ged';

      // Extrai o path do objeto da URL
      let objectPath = urlOuPath;
      const bucketPrefix = `/${bucket}/`;
      const idx = urlOuPath.indexOf(bucketPrefix);
      if (idx !== -1) {
        objectPath = urlOuPath.slice(idx + bucketPrefix.length);
      }

      await client.removeObject(bucket, objectPath);
    } catch (err) {
      this.logger.warn(
        `MinIO delete falhou para ${urlOuPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async gerarThumbnail(
    buffer: Buffer,
    tenantId: number,
    rdoId: number,
    nomeOriginal: string,
    ext: string,
  ): Promise<string | null> {
    // Usa sharp se disponível; caso contrário retorna null
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharp = require('sharp');
      const thumbBuffer: Buffer = await sharp(buffer)
        .resize({ width: 400, withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();

      const thumbName = nomeOriginal.replace(`.${ext}`, '_thumb.jpg');
      const thumbPath = `rdo-fotos/tenant-${tenantId}/rdo-${rdoId}/thumbs/${thumbName}`;
      return this.uploadMinio(thumbBuffer, thumbPath, 'image/jpeg');
    } catch {
      return null;
    }
  }
}
