// backend/src/ncs/nc-evidencia.service.ts
//
// Upload direto de foto/evidência para NC (reusando pipeline do GED).
// Padrão espelha RdoFotosService: multipart → GedService.upload() →
// atualiza nao_conformidades.ged_versao_id com o novo versaoId.
//
// Modelo atual: NC tem 1 evidência GED por vez (campo ged_versao_id é
// escalar). Fazer upload de uma nova foto SUBSTITUI a evidência anterior —
// a versão antiga permanece no GED (soft-ref), apenas não é mais referenciada
// pela NC. Se quiser múltiplas evidências, futura migration cria nc_fotos.

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GedService } from '../ged/ged.service';

const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

const TAMANHO_MAX = 10 * 1024 * 1024; // 10 MB — foto de obra + PDF de laudo típico

interface NcRow {
  id: number;
  obra_id: number;
  numero: string;
  status: string;
}

export interface UploadEvidenciaResult {
  ged_versao_id: number;
  ged_codigo: string;
  ged_titulo: string;
  storage_key: string;
  presigned_url: string;
}

@Injectable()
export class NcEvidenciaService {
  private readonly logger = new Logger(NcEvidenciaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gedService: GedService,
  ) {}

  async uploadEvidencia(
    tenantId: number,
    ncId: number,
    usuarioId: number,
    file: Express.Multer.File,
  ): Promise<UploadEvidenciaResult> {
    // 1. Validar MIME e tamanho
    if (!file || !file.buffer) {
      throw new BadRequestException('Arquivo vazio ou inválido');
    }
    const ext = MIME_PERMITIDOS[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${file.mimetype}. Use JPG, PNG, WebP, HEIC ou PDF.`,
      );
    }
    if (file.size > TAMANHO_MAX) {
      throw new BadRequestException(
        `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${TAMANHO_MAX / 1024 / 1024} MB.`,
      );
    }

    // 2. Validar NC e obter obra_id
    const ncRows = await this.prisma.$queryRawUnsafe<NcRow[]>(
      `SELECT id, obra_id, numero, status FROM nao_conformidades
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      ncId,
      tenantId,
    );
    if (!ncRows.length) {
      throw new NotFoundException(`NC ${ncId} não encontrada`);
    }
    const nc = ncRows[0];
    if (nc.status === 'FECHADA') {
      throw new BadRequestException('Não é possível anexar evidência a uma NC já fechada');
    }

    // 3. Resolver categoria e pasta
    const categoriaId = await this.resolverCategoriaEvidenciaNc();
    const pastaId = await this.resolverPastaEvidenciasNc(tenantId, nc.obra_id);

    // 4. Upload GED
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).slice(2, 10);
    const nomeArquivo = `nc-${nc.numero}-${timestamp}-${randomHex}.${ext}`;

    const fileParaGed = {
      ...file,
      originalname: nomeArquivo,
    } as Express.Multer.File;

    const gedResult = await this.gedService.upload(
      tenantId,
      usuarioId,
      nc.obra_id,
      fileParaGed,
      {
        titulo: `Evidência NC ${nc.numero} — ${new Date().toISOString().slice(0, 10)}`,
        categoriaId,
        pastaId,
        escopo: 'OBRA',
        // sem workflow — evidência é fato, não documento controlado
      },
    );

    // 5. Buscar storage_key + presigned URL
    const versaoRows = await this.prisma.$queryRawUnsafe<{
      storage_key: string;
    }[]>(
      `SELECT storage_key FROM ged_versoes WHERE id = $1`,
      gedResult.versaoId,
    );
    const storageKey = versaoRows[0]?.storage_key ?? '';
    const presignedUrl = await this.gedService.getStorageUrl(storageKey, 3600);

    // 6. Atualizar NC — aponta ged_versao_id para nova versão + preenche
    //    evidencia_url com a presigned (legado/fallback). Versão anterior
    //    permanece no GED mas não é mais referenciada.
    await this.prisma.$executeRawUnsafe(
      `UPDATE nao_conformidades
         SET ged_versao_id = $1,
             evidencia_url = $2,
             updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      gedResult.versaoId,
      presignedUrl,
      ncId,
      tenantId,
    );

    this.logger.log(
      JSON.stringify({
        action: 'nc.evidencia.upload.ok',
        ncId,
        tenantId,
        usuarioId,
        gedVersaoId: gedResult.versaoId,
        bytes: file.size,
        mime: file.mimetype,
      }),
    );

    return {
      ged_versao_id: gedResult.versaoId,
      ged_codigo: gedResult.codigoGerado,
      ged_titulo: `Evidência NC ${nc.numero} — ${new Date().toISOString().slice(0, 10)}`,
      storage_key: storageKey,
      presigned_url: presignedUrl,
    };
  }

  // ─── Helpers GED ──────────────────────────────────────────────────────────

  /**
   * Resolve o ID da categoria de sistema "EVIDENCIA_NC" (tenant_id=0).
   * Criada pela migration 20260420130000_nc_evidencia_ged_categoria.
   */
  private async resolverCategoriaEvidenciaNc(): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_categorias
       WHERE codigo = 'EVIDENCIA_NC' AND tenant_id = 0 AND deleted_at IS NULL
       LIMIT 1`,
    );
    if (!rows.length) {
      throw new BadRequestException(
        'Categoria GED "EVIDENCIA_NC" não encontrada. Rode a migration 20260420130000_nc_evidencia_ged_categoria.',
      );
    }
    return rows[0].id;
  }

  /**
   * Garante a existência de uma pasta "Evidências NC" (raiz) por obra.
   * Idempotente. Mesmo padrão do RdoFotosService.
   */
  private async resolverPastaEvidenciasNc(tenantId: number, obraId: number): Promise<number> {
    const existentes = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_pastas
       WHERE tenant_id = $1
         AND obra_id = $2
         AND escopo = 'OBRA'
         AND nome = 'Evidências NC'
         AND parent_id IS NULL
         AND deleted_at IS NULL
       LIMIT 1`,
      tenantId,
      obraId,
    );
    if (existentes.length) return existentes[0].id;

    const inseridos = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO ged_pastas
         (tenant_id, escopo, obra_id, parent_id, nome, path, nivel, configuracoes, settings_efetivos)
       VALUES ($1, 'OBRA', $2, NULL, 'Evidências NC', '', 1, '{}'::jsonb, '{}'::jsonb)
       RETURNING id`,
      tenantId,
      obraId,
    );
    const pastaId = inseridos[0].id;

    // Atualiza path usando o ID recém-gerado (mesmo padrão do GedPastasService)
    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_pastas SET path = $1 WHERE id = $2`,
      `/${pastaId}/`,
      pastaId,
    );

    return pastaId;
  }
}
