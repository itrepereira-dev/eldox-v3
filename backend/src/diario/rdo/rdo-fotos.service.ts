// backend/src/diario/rdo/rdo-fotos.service.ts
// Sprint B1 — Upload/listagem/exclusão de fotos do RDO
//
// Agent A (2026-04-20): migrado de upload direto MinIO para GedService.upload().
// Motivação: skill ged-enterprise exige que diário referencie documentos do GED.
// Cada foto agora cria um documento + versão no GED (categoria "FOTO_RDO",
// status RASCUNHO, sem workflow), e `rdo_fotos.ged_versao_id` aponta pra ela.
// Campos legados `url`/`thumbnail_url` permanecem populados para compat com
// fotos antigas e também pra facilitar leitura sem novo presigned em
// listagens pesadas.
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GedService } from '../../ged/ged.service';

const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const TAMANHO_MAX = 20 * 1024 * 1024; // 20 MB por foto

// TTL da URL presigned devolvida em listagem — suficiente pra a sessão,
// sem vazar URL eterna em logs/caches.
const PRESIGNED_TTL_SECONDS = 3600;

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
  ged_versao_id: number | null;
}

@Injectable()
export class RdoFotosService {
  private readonly logger = new Logger(RdoFotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gedService: GedService,
  ) {}

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
    const rdoRows = await this.prisma.$queryRawUnsafe<{ id: number; status: string; obra_id: number }[]>(
      `SELECT id, status, obra_id FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      rdoId,
      tenantId,
    );
    if (!rdoRows.length) {
      throw new NotFoundException(`RDO ${rdoId} não encontrado`);
    }
    if (rdoRows[0].status === 'aprovado') {
      throw new ForbiddenException('Não é possível adicionar fotos a um RDO aprovado');
    }
    const obraId = rdoRows[0].obra_id;

    // 5. Gerar nome único
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).slice(2, 10);
    const nomeArquivo = `rdo-${rdoId}-${timestamp}-${randomHex}.${ext}`;

    // 6. Resolver categoria FOTO_RDO + pasta "Fotos RDO" da obra (auto-cria na
    //    primeira foto). Fotos compartilham o mesmo documento GED por RDO
    //    para evitar explosão de documentos (1 RDO com 50 fotos = 1 doc GED).
    const categoriaId = await this.resolverCategoriaFotoRdo(tenantId);
    const pastaId = await this.resolverPastaFotosRdo(tenantId, obraId);

    // 7. Monta Multer-like File e chama GedService.upload().
    //    Cada foto vira 1 documento + 1 versão. É heavy mas dá audit log,
    //    QR code, checksum e centraliza no GED — atende exigência da skill.
    //    GedService.upload() usa apenas buffer/originalname/mimetype/size —
    //    o cast por `as unknown as Express.Multer.File` evita preencher o
    //    shape completo de Multer (stream/destination/path) que não é usado.
    const file = {
      buffer,
      originalname: nomeArquivo,
      mimetype: mimeType,
      size: buffer.length,
      fieldname: 'foto',
      encoding: '7bit',
    } as unknown as Express.Multer.File;

    const gedResult = await this.gedService.upload(
      tenantId,
      usuarioId,
      obraId,
      file,
      {
        titulo: legenda?.trim() ? legenda.slice(0, 255) : `Foto RDO #${rdoId} — ${new Date().toISOString().slice(0, 10)}`,
        categoriaId,
        pastaId,
        escopo: 'OBRA',
        // sem workflowTemplateId — fotos não passam por aprovação GED
      },
    );

    // 8. Busca storage_key / bucket da versão recém criada para montar URL
    //    pública direta (mantida em `url` por compat) + presigned URL da sessão.
    const versaoRows = await this.prisma.$queryRawUnsafe<{
      storage_key: string;
      storage_bucket: string;
    }[]>(
      `SELECT storage_key, storage_bucket FROM ged_versoes WHERE id = $1`,
      gedResult.versaoId,
    );
    const storageKey = versaoRows[0]?.storage_key ?? '';
    const presignedUrl = await this.gedService.getStorageUrl(storageKey, PRESIGNED_TTL_SECONDS);

    // 9. Persistir linha em rdo_fotos apontando para ged_versoes.
    //    Mantemos `url` preenchido com a presigned URL para compat — fotos
    //    antigas continuam funcionando e listagens pré-migração não quebram.
    //    `thumbnail_url = null` (thumbnail pode ser gerado via worker GED depois).
    const rows = await this.prisma.$queryRawUnsafe<FotoRow[]>(
      `INSERT INTO rdo_fotos
         (rdo_id, tenant_id, url, thumbnail_url, nome_arquivo, tamanho_bytes, upload_por, legenda, ged_versao_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      rdoId,
      tenantId,
      presignedUrl,
      null,
      nomeArquivo,
      buffer.length,
      usuarioId,
      legenda ?? null,
      gedResult.versaoId,
    );

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'rdo.foto.upload.ok',
        rdo_id: rdoId,
        tenant_id: tenantId,
        nome: nomeArquivo,
        bytes: buffer.length,
        ged_versao_id: gedResult.versaoId,
        ged_documento_id: gedResult.documentoId,
      }),
    );

    return rows[0];
  }

  // ─── Listar fotos ─────────────────────────────────────────────────────────

  async listar(tenantId: number, rdoId: number): Promise<FotoRow[]> {
    // Verificar que RDO pertence ao tenant
    const rdoRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      rdoId,
      tenantId,
    );
    if (!rdoRows.length) {
      throw new NotFoundException(`RDO ${rdoId} não encontrado`);
    }

    // JOIN com ged_versoes traz storage_key para regenerar presigned URL
    // fresh em cada listagem. Fotos legadas (sem ged_versao_id) caem no
    // fallback do `url` já persistido.
    type Row = FotoRow & { storage_key: string | null };
    const rows = await this.prisma.$queryRawUnsafe<Row[]>(
      `SELECT f.*, v.storage_key
       FROM rdo_fotos f
       LEFT JOIN ged_versoes v ON v.id = f.ged_versao_id
       WHERE f.rdo_id = $1 AND f.tenant_id = $2
       ORDER BY f.created_at ASC`,
      rdoId,
      tenantId,
    );

    // Regenera URLs presigned para fotos que passaram pelo GED — garante TTL
    // válido no cliente. Fotos legadas mantêm o `url` antigo (pode estar
    // expirado; caller que precisar de fresh tem que renovar manualmente).
    const fotosComUrl: FotoRow[] = [];
    for (const row of rows) {
      const { storage_key, ...foto } = row;
      if (storage_key) {
        try {
          foto.url = await this.gedService.getStorageUrl(storage_key, PRESIGNED_TTL_SECONDS);
        } catch (err) {
          this.logger.warn(
            `Falha ao gerar presigned URL para foto ${foto.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      fotosComUrl.push(foto);
    }
    return fotosComUrl;
  }

  // ─── Atualizar legenda da foto ────────────────────────────────────────────

  async atualizarLegenda(
    tenantId: number,
    rdoId: number,
    fotoId: number,
    legenda: string,
  ): Promise<FotoRow> {
    // Valida que a foto existe e pertence ao tenant/RDO
    const rows = await this.prisma.$queryRawUnsafe<FotoRow[]>(
      `SELECT * FROM rdo_fotos WHERE id = $1 AND rdo_id = $2 AND tenant_id = $3`,
      fotoId,
      rdoId,
      tenantId,
    );
    if (!rows.length) {
      throw new NotFoundException(`Foto ${fotoId} não encontrada`);
    }

    // RDO aprovado não permite editar legenda (imutabilidade)
    const rdoRows = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM rdos WHERE id = $1 AND tenant_id = $2`,
      rdoId,
      tenantId,
    );
    if (rdoRows[0]?.status === 'aprovado') {
      throw new ForbiddenException(
        'Não é possível editar legendas de um RDO aprovado',
      );
    }

    // Limite VARCHAR(300) no schema
    const legendaNormalizada = (legenda ?? '').slice(0, 300);

    const updated = await this.prisma.$queryRawUnsafe<FotoRow[]>(
      `UPDATE rdo_fotos SET legenda = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      legendaNormalizada,
      fotoId,
      tenantId,
    );
    return updated[0];
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
    const rdoRows = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM rdos WHERE id = $1 AND tenant_id = $2`,
      rdoId,
      tenantId,
    );
    if (rdoRows[0]?.status === 'aprovado') {
      throw new ForbiddenException('Não é possível excluir fotos de um RDO aprovado');
    }

    const foto = rows[0];

    // Excluir linha da foto do RDO
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM rdo_fotos WHERE id = $1 AND tenant_id = $2`,
      fotoId,
      tenantId,
    );

    // Cancela a versão GED correspondente para evitar documento órfão.
    // Se a versão já está em estado terminal (IFC/IFP/AS_BUILT/OBSOLETO), o
    // GedService.cancelar() lança BadRequestException — tratamos silenciosamente
    // e seguimos, pois a exclusão do lado RDO já ocorreu. Fotos legadas sem
    // ged_versao_id também são ignoradas.
    if (foto.ged_versao_id != null) {
      try {
        await this.gedService.cancelar(
          tenantId,
          usuarioId,
          foto.ged_versao_id,
          'Foto do RDO excluída pelo usuário',
        );
      } catch (err) {
        this.logger.warn(
          JSON.stringify({
            level: 'warn',
            action: 'rdo.foto.excluir.ged_cancelar_falhou',
            foto_id: fotoId,
            ged_versao_id: foto.ged_versao_id,
            motivo: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'rdo.foto.excluir.ok',
        foto_id: fotoId,
        rdo_id: rdoId,
        tenant_id: tenantId,
        usuario_id: usuarioId,
        ged_versao_id: foto.ged_versao_id,
      }),
    );
  }

  // ─── Helpers GED ──────────────────────────────────────────────────────────

  /**
   * Resolve o ID da categoria "FOTO_RDO" (seed de sistema em tenant_id=0).
   * Lançamos erro amigável se a migration não rodou — evita crash obscuro
   * no INSERT em ged_documentos.
   */
  private async resolverCategoriaFotoRdo(_tenantId: number): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_categorias
       WHERE codigo = 'FOTO_RDO' AND tenant_id = 0 AND deleted_at IS NULL
       LIMIT 1`,
    );
    if (!rows.length) {
      throw new BadRequestException(
        'Categoria GED "FOTO_RDO" não encontrada. Rode a migration 20260420120000_rdo_fotos_ged_integration.',
      );
    }
    return rows[0].id;
  }

  /**
   * Garante a existência de uma pasta "Fotos RDO" (raiz) por obra. Idempotente.
   * Pasta é criada com configurações vazias — herda defaults do tenant.
   */
  private async resolverPastaFotosRdo(tenantId: number, obraId: number): Promise<number> {
    // 1. Tenta encontrar pasta existente
    const existentes = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_pastas
       WHERE tenant_id = $1
         AND obra_id = $2
         AND escopo = 'OBRA'
         AND nome = 'Fotos RDO'
         AND parent_id IS NULL
         AND deleted_at IS NULL
       LIMIT 1`,
      tenantId,
      obraId,
    );
    if (existentes.length) return existentes[0].id;

    // 2. Cria pasta raiz "Fotos RDO" — path é definido depois da inserção
    //    pra usar o ID gerado. Mesmo padrão de GedPastasService.criarPasta().
    const inseridos = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO ged_pastas
         (tenant_id, escopo, obra_id, parent_id, nome, path, nivel, configuracoes, settings_efetivos)
       VALUES ($1, 'OBRA', $2, NULL, 'Fotos RDO', '', 1, '{}'::jsonb, '{}'::jsonb)
       RETURNING id`,
      tenantId,
      obraId,
    );
    const pastaId = inseridos[0].id;
    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_pastas SET path = $1 WHERE id = $2`,
      `/${pastaId}`,
      pastaId,
    );
    this.logger.log(
      `Pasta auto-criada: "Fotos RDO" id=${pastaId} tenant=${tenantId} obra=${obraId}`,
    );
    return pastaId;
  }
}
