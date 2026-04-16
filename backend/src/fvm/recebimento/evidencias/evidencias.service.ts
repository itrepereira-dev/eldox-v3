// backend/src/fvm/recebimento/evidencias/evidencias.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GedService } from '../../../ged/ged.service';
import type { VincularEvidenciaDto } from './dto/vincular-evidencia.dto';

interface RawEvidencia {
  id: number;
  tenant_id: number;
  lote_id: number;
  ged_versao_id: number;
  tipo: string;
  descricao: string | null;
  criado_em: Date;
  ged_titulo: string;
  ged_codigo: string | null;
  ged_status: string;
  ged_mime_type: string;
  ged_nome_original: string;
  ged_tamanho_bytes: number;
}

// Estrutura flat compatível com o frontend (EvidenciaLote interface)
export interface FvmEvidenciaComGed {
  id: number;
  lote_id: number;
  ged_versao_id: number;
  tipo: string;
  descricao: string | null;
  criado_em: string;
  ged_titulo: string;
  ged_codigo: string | null;
  ged_status: string;
  ged_mime_type: string;
  ged_nome_original: string;
  ged_tamanho_bytes: number;
  download_url: string | null;
  download_expires_in: number | null;
}

@Injectable()
export class EvidenciasService {
  private readonly logger = new Logger(EvidenciasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gedService: GedService,
  ) {}

  // ── POST /api/v1/fvm/lotes/:loteId/evidencias ──────────────────────────────

  async vincular(
    tenantId: number,
    userId: number,
    loteId: number,
    dto: VincularEvidenciaDto,
  ): Promise<object> {
    // 1. Valida que o lote existe e pertence ao tenant
    const loteRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM fvm_lotes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      loteId, tenantId,
    );
    if (!loteRows.length) {
      throw new NotFoundException(`Lote ${loteId} não encontrado`);
    }

    // 2. Valida que a versão GED existe (sem tenant — para distinguir 404 real de 403 cross-tenant)
    const versaoAny = await this.prisma.$queryRawUnsafe<{
      id: number; titulo: string; codigo: string | null; status: string;
      tenant_id: number; mime_type: string; nome_original: string; tamanho_bytes: number;
    }[]>(
      `SELECT v.id, v.titulo, v.status, v.tenant_id,
              v.mime_type, v.nome_original, v.tamanho_bytes,
              d.codigo
       FROM ged_versoes v
       LEFT JOIN ged_documentos d ON d.id = v.documento_id
       WHERE v.id = $1 AND v.deleted_at IS NULL`,
      dto.ged_versao_id,
    );
    if (!versaoAny.length) {
      throw new NotFoundException(`Versão GED ${dto.ged_versao_id} não encontrada`);
    }
    if (versaoAny[0].tenant_id !== tenantId) {
      throw new ForbiddenException(`Acesso negado: versão GED pertence a outro tenant`);
    }
    const versao = versaoAny[0];

    // 3. Insere em fvm_evidencias
    const rows = await this.prisma.$queryRawUnsafe<{
      id: number; ged_versao_id: number; tipo: string; descricao: string | null; created_at: Date;
    }[]>(
      `INSERT INTO fvm_evidencias (tenant_id, lote_id, tipo, ged_versao_id, descricao)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, lote_id, ged_versao_id, tipo, descricao, created_at`,
      tenantId, loteId, dto.tipo, dto.ged_versao_id, dto.descricao ?? null,
    );
    const evidencia = rows[0];

    // 4. Audit log estruturado
    this._auditLog({
      tenantId, userId, acao: 'FVM_EVIDENCIA_VINCULAR',
      entidade: 'fvm_evidencias', entidadeId: evidencia.id,
      detalhes: { lote_id: loteId, ged_versao_id: dto.ged_versao_id, tipo: dto.tipo },
    });

    // Retorna estrutura flat compatível com EvidenciaLote (frontend)
    return {
      id:               evidencia.id,
      lote_id:          loteId,
      ged_versao_id:    evidencia.ged_versao_id,
      tipo:             evidencia.tipo,
      descricao:        evidencia.descricao,
      criado_em:        (evidencia.created_at as Date).toISOString(),
      ged_titulo:       versao.titulo,
      ged_codigo:       versao.codigo ?? null,
      ged_status:       versao.status,
      ged_mime_type:    versao.mime_type,
      ged_nome_original: versao.nome_original,
      ged_tamanho_bytes: Number(versao.tamanho_bytes),
      download_url:     null, // frontend vai buscar via useDownloadUrl
      download_expires_in: null,
    };
  }

  // ── GET /api/v1/fvm/lotes/:loteId/evidencias ──────────────────────────────

  async listar(
    tenantId: number,
    userId: number,
    loteId: number,
  ): Promise<FvmEvidenciaComGed[]> {
    // Valida que o lote existe e pertence ao tenant
    const loteRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM fvm_lotes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      loteId, tenantId,
    );
    if (!loteRows.length) {
      throw new NotFoundException(`Lote ${loteId} não encontrado`);
    }

    // Busca evidências com JOIN completo em ged_versoes e ged_documentos
    const rows = await this.prisma.$queryRawUnsafe<RawEvidencia[]>(
      `SELECT
         e.id, e.tenant_id, e.lote_id,
         e.tipo, e.ged_versao_id, e.descricao,
         e.created_at AS criado_em,
         v.titulo      AS ged_titulo,
         v.status      AS ged_status,
         v.mime_type   AS ged_mime_type,
         v.nome_original AS ged_nome_original,
         v.tamanho_bytes AS ged_tamanho_bytes,
         d.codigo      AS ged_codigo
       FROM fvm_evidencias e
       JOIN ged_versoes v ON v.id = e.ged_versao_id
       LEFT JOIN ged_documentos d ON d.id = v.documento_id
       WHERE e.lote_id = $1 AND e.tenant_id = $2
       ORDER BY e.created_at ASC`,
      loteId, tenantId,
    );

    // Para cada evidência, gera presigned URL via GedService (flat response)
    const result: FvmEvidenciaComGed[] = [];
    for (const row of rows) {
      let download_url: string | null = null;
      let download_expires_in: number | null = null;

      try {
        const dl = await this.gedService.download(tenantId, userId, row.ged_versao_id);
        download_url = dl.presignedUrl;
        download_expires_in = dl.expiresInSeconds;
      } catch (err) {
        this.logger.warn(
          `Falha ao gerar presigned URL para versão ${row.ged_versao_id}: ${(err as Error).message}`,
        );
      }

      result.push({
        id:                row.id,
        lote_id:           row.lote_id,
        ged_versao_id:     row.ged_versao_id,
        tipo:              row.tipo,
        descricao:         row.descricao,
        criado_em:         (row.criado_em as unknown as Date).toISOString(),
        ged_titulo:        row.ged_titulo,
        ged_codigo:        row.ged_codigo ?? null,
        ged_status:        row.ged_status,
        ged_mime_type:     row.ged_mime_type,
        ged_nome_original: row.ged_nome_original,
        ged_tamanho_bytes: Number(row.ged_tamanho_bytes),
        download_url,
        download_expires_in,
      });
    }

    return result;
  }

  // ── DELETE /api/v1/fvm/evidencias/:id ─────────────────────────────────────

  async desvincular(
    tenantId: number,
    userId: number,
    evidenciaId: number,
  ): Promise<{ deleted: boolean }> {
    // 2 queries: distingue 404 real (não existe) de 403 (existe mas é de outro tenant)
    const anyRows = await this.prisma.$queryRawUnsafe<{ id: number; tenant_id: number }[]>(
      `SELECT id, tenant_id FROM fvm_evidencias WHERE id = $1`,
      evidenciaId,
    );
    if (!anyRows.length) {
      throw new NotFoundException(`Evidência ${evidenciaId} não encontrada`);
    }
    if (anyRows[0].tenant_id !== tenantId) {
      throw new ForbiddenException(`Acesso negado`);
    }

    // Hard delete (vínculo, não o doc GED)
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvm_evidencias WHERE id = $1 AND tenant_id = $2`,
      evidenciaId, tenantId,
    );

    // Audit log estruturado
    this._auditLog({
      tenantId, userId, acao: 'FVM_EVIDENCIA_DESVINCULAR',
      entidade: 'fvm_evidencias', entidadeId: evidenciaId,
      detalhes: {},
    });

    return { deleted: true };
  }

  // ── Audit log ─────────────────────────────────────────────────────────────

  private _auditLog(params: {
    tenantId: number;
    userId: number;
    acao: string;
    entidade: string;
    entidadeId: number;
    detalhes: object;
  }): void {
    // Tenta inserir em audit_log se a tabela existir; caso contrário, usa log estruturado
    this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, detalhes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      params.tenantId,
      params.userId,
      params.acao,
      params.entidade,
      params.entidadeId,
      JSON.stringify(params.detalhes),
    ).catch(() => {
      // Fallback: log estruturado quando a tabela ainda não existe
      this.logger.log(
        JSON.stringify({
          audit: true,
          tenant_id:  params.tenantId,
          usuario_id: params.userId,
          acao:       params.acao,
          entidade:   params.entidade,
          entidade_id: params.entidadeId,
          detalhes:   params.detalhes,
          ts:         new Date().toISOString(),
        }),
      );
    });
  }
}
