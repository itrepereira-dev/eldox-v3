// src/ged/ged.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from './storage/minio.service';
import { WorkflowService } from './workflow/workflow.service';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { ListDocumentosDto } from './dto/list-documentos.dto';
import { AprovarDto } from './dto/aprovar.dto';
import { RejeitarDto } from './dto/rejeitar.dto';
import {
  GedDocumento,
  GedVersao,
  GedConfiguracao,
  GedStatusVersao,
  GedUploadResult,
  GedDownloadResult,
  GedListaMestraItem,
} from './types/ged.types';

// Formatos de arquivo permitidos pelo GED
const FORMATOS_PERMITIDOS = new Set([
  'application/pdf',
  'image/vnd.dwg',
  'image/x-dwg',
  'application/acad',
  'application/x-autocad',
  'image/x-dxf',
  'application/dxf',
  'application/x-step',
  'application/ifc',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
]);

const EXTENSOES_PERMITIDAS = new Set([
  '.pdf', '.dwg', '.dxf', '.ifc', '.jpg', '.jpeg', '.png', '.docx', '.xlsx', '.doc', '.xls',
]);

// TTL em segundos para URLs pré-assinadas
const PRESIGNED_TTL_DOWNLOAD = 300;   // 5 minutos
const PRESIGNED_TTL_QR = 600;         // 10 minutos

// Transições de status válidas
const TRANSICOES_VALIDAS: Record<GedStatusVersao, GedStatusVersao[]> = {
  RASCUNHO: ['IFA', 'CANCELADO'],
  IFA: ['IFC', 'IFP', 'AS_BUILT', 'REJEITADO', 'CANCELADO'],
  IFC: ['OBSOLETO', 'CANCELADO'],
  IFP: ['OBSOLETO', 'CANCELADO'],
  AS_BUILT: ['OBSOLETO', 'CANCELADO'],
  REJEITADO: ['RASCUNHO'],
  OBSOLETO: [],
  CANCELADO: [],
};

@Injectable()
export class GedService {
  private readonly logger = new Logger(GedService.name);
  private readonly gedQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly workflowService: WorkflowService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @InjectQueue('ged') gedQueue: any,
  ) {
    this.gedQueue = gedQueue as Queue;
  }

  // ─── Configurações do Tenant ──────────────────────────────────────────────

  private async buscarConfiguracoes(tenantId: number): Promise<GedConfiguracao> {
    // ged_configuracoes usa tenant_id como PK — sem coluna `id`.
    const rows = await this.prisma.$queryRawUnsafe<GedConfiguracao[]>(
      `SELECT tenant_id, modo_auditoria, workflow_obrigatorio, qr_code_ativo,
              ocr_ativo, whatsapp_ativo, storage_limite_gb
       FROM ged_configuracoes
       WHERE tenant_id = $1`,
      tenantId,
    );

    if (!rows.length) {
      return {
        tenant_id: tenantId,
        modo_auditoria: true,
        workflow_obrigatorio: false,
        qr_code_ativo: true,
        ocr_ativo: true,
        whatsapp_ativo: false,
        storage_limite_gb: 10,
      };
    }
    return rows[0];
  }

  // ─── Validações ───────────────────────────────────────────────────────────

  private validarFormatoArquivo(file: Express.Multer.File): void {
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();

    if (!FORMATOS_PERMITIDOS.has(file.mimetype) && !EXTENSOES_PERMITIDAS.has(ext)) {
      throw new BadRequestException(
        `Formato de arquivo não permitido: ${file.mimetype}. ` +
        `Formatos aceitos: PDF, DWG, DXF, IFC, JPG, PNG, DOCX, XLSX.`,
      );
    }
  }

  private validarTransicao(statusAtual: GedStatusVersao, statusAlvo: GedStatusVersao): void {
    const permitidos = TRANSICOES_VALIDAS[statusAtual] ?? [];
    if (!permitidos.includes(statusAlvo)) {
      throw new BadRequestException(
        `Transição inválida: ${statusAtual} → ${statusAlvo}. ` +
        `Transições permitidas: ${permitidos.join(', ') || 'nenhuma'}.`,
      );
    }
  }

  // ─── Geração de Código ────────────────────────────────────────────────────

  private async gerarCodigo(
    tenantId: number,
    obraId: number | null,
    disciplina: string,
  ): Promise<string> {
    const discSigla = (disciplina || 'GER').toUpperCase().substring(0, 3);

    // Escopo EMPRESA: não há obra de origem, usa prefixo "EMP" e conta pelos
    // documentos corporativos do tenant (obra_id IS NULL) na mesma disciplina.
    if (obraId === null) {
      const counts = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*) AS count
         FROM ged_documentos
         WHERE obra_id IS NULL AND tenant_id = $1 AND disciplina = $2`,
        tenantId,
        disciplina,
      );
      const seq = parseInt(counts[0]?.count ?? '0', 10) + 1;
      const seqFormatado = String(seq).padStart(3, '0');
      return `EMP-${discSigla}-${seqFormatado}`;
    }

    // Busca código da obra (Prisma usa "Obra" com camelCase no banco)
    const obras = await this.prisma.$queryRawUnsafe<{ codigo: string }[]>(
      `SELECT codigo FROM "Obra" WHERE id = $1 AND "tenantId" = $2`,
      obraId,
      tenantId,
    );

    const codigoObra = obras.length ? obras[0].codigo : `OBR${obraId}`;

    const counts = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count
       FROM ged_documentos
       WHERE obra_id = $1 AND tenant_id = $2 AND disciplina = $3`,
      obraId,
      tenantId,
      disciplina,
    );

    const seq = parseInt(counts[0]?.count ?? '0', 10) + 1;
    const seqFormatado = String(seq).padStart(3, '0');

    return `${codigoObra}-${discSigla}-${seqFormatado}`;
  }

  // ─── Audit Log ────────────────────────────────────────────────────────────

  private async gravarAuditLog(params: {
    tenantId: number;
    versaoId: number;
    userId: number;
    acao: string;
    statusDe?: GedStatusVersao | null;
    statusPara?: GedStatusVersao | null;
    ipOrigem?: string | null;
    detalhes?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ged_audit_log
         (tenant_id, versao_id, usuario_id, acao, status_de, status_para, ip_origem, detalhes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      params.tenantId,
      params.versaoId,
      params.userId,
      params.acao,
      params.statusDe ?? null,
      params.statusPara ?? null,
      params.ipOrigem ?? null,
      JSON.stringify(params.detalhes ?? {}),
    );
  }

  // ─── Upload ───────────────────────────────────────────────────────────────

  async upload(
    tenantId: number,
    userId: number,
    obraId: number | null,
    file: Express.Multer.File,
    dto: UploadDocumentoDto,
    ipOrigem?: string,
  ): Promise<GedUploadResult> {
    const config = await this.buscarConfiguracoes(tenantId);

    this.validarFormatoArquivo(file);

    // Quando obraId é null, estamos em escopo EMPRESA — força `escopo='EMPRESA'`
    // mesmo que o DTO não tenha mandado. Isso mantém a coluna ged_documentos.escopo
    // coerente com obra_id=NULL (escopo_padrao das categorias corporativas).
    const escopoFinal: 'EMPRESA' | 'OBRA' = obraId === null ? 'EMPRESA' : (dto.escopo ?? 'OBRA');

    // B9: quota de storage do tenant. Some bytes de todas as versões ativas
    // + o arquivo novo e compare com o limite em GB. Rejeita antes de gastar
    // MinIO + CPU de checksum.
    await this.validarQuotaStorage(tenantId, file.size, config.storage_limite_gb);

    const codigoGerado = dto.codigoCustom
      ? dto.codigoCustom
      : await this.gerarCodigo(tenantId, obraId, dto.disciplina ?? 'GER');

    // Verifica unicidade do código no tenant
    const codigoExistente = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_documentos WHERE codigo = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      codigoGerado,
      tenantId,
    );
    if (codigoExistente.length) {
      throw new BadRequestException(`Código de documento já existe: ${codigoGerado}`);
    }

    const checksum = this.minioService.calcularChecksum(file.buffer);

    // B10: INSERT documento + upload MinIO + INSERT versão + audit log atômicos.
    // Ordem: insere doc → monta storage_key (que usa documentId) → put MinIO →
    // insere versão + audit. Se MinIO falhar, a transaction faz rollback e
    // nada fica no banco. Se commit falhar após put, sobra órfão no MinIO —
    // aceitável, pode ser limpo por worker posterior comparando ged_versoes
    // com listagem do bucket.
    const result = await this.prisma.$transaction(async (tx) => {
      const docRows = await tx.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO ged_documentos
           (tenant_id, escopo, obra_id, pasta_id, categoria_id, titulo, codigo, disciplina)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        tenantId,
        escopoFinal,
        obraId,
        dto.pastaId,
        dto.categoriaId,
        dto.titulo,
        codigoGerado,
        dto.disciplina ?? null,
      );

      const documentoId = docRows[0].id;

      const storageKey = this.minioService.buildStorageKey(
        tenantId,
        obraId,
        documentoId,
        file.originalname,
      );

      // put fora do controle transacional do Prisma mas dentro do try —
      // se lançar, a tx reverte.
      const { bucket } = await this.minioService.uploadFile(
        file.buffer,
        storageKey,
        file.mimetype,
      );

      const versaoRows = await tx.$queryRawUnsafe<{ id: number; qr_token: string }[]>(
        `INSERT INTO ged_versoes
           (documento_id, tenant_id, numero_revisao, version, status, storage_key, storage_bucket,
            mime_type, tamanho_bytes, checksum_sha256, nome_original, criado_por,
            workflow_template_id, qr_token)
         VALUES ($1, $2, $3, 1, 'RASCUNHO', $4, $5, $6, $7, $8, $9, $10, $11, gen_random_uuid())
         RETURNING id, qr_token`,
        documentoId,
        tenantId,
        dto.numeroRevisao ?? 'R00',
        storageKey,
        bucket,
        file.mimetype,
        file.size,
        checksum,
        file.originalname,
        userId,
        dto.workflowTemplateId ?? null,
      );

      const versaoId = versaoRows[0].id;
      const qrToken = versaoRows[0].qr_token;

      // Audit log dentro da tx — usa o mesmo `tx` pra manter atomicidade.
      await tx.$executeRawUnsafe(
        `INSERT INTO ged_audit_log
           (tenant_id, versao_id, usuario_id, acao, status_de, status_para, ip_origem, detalhes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        tenantId,
        versaoId,
        userId,
        'UPLOAD',
        null,
        'RASCUNHO',
        ipOrigem ?? null,
        JSON.stringify({ documentoId, codigoGerado, nomeOriginal: file.originalname }),
      );

      return { documentoId, versaoId, qrToken };
    });

    if (config.ocr_ativo) {
      await this.gedQueue.add(
        'ged.ocr',
        { versaoId: result.versaoId, tenantId },
        { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: true },
      );
    }

    // Thumbnail: enfileira apenas quando o arquivo é imagem. O worker também
    // checa o mime_type por garantia (idempotência defensiva).
    if (file.mimetype?.startsWith('image/')) {
      await this.gedQueue.add(
        'ged.thumbnail',
        { versaoId: result.versaoId, tenantId },
        { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: true },
      );
    }

    this.logger.log(
      `Upload: doc=${result.documentoId} versao=${result.versaoId} codigo=${codigoGerado}`,
    );

    return {
      documentoId: result.documentoId,
      versaoId: result.versaoId,
      codigoGerado,
      status: 'RASCUNHO',
      qrToken: result.qrToken,
    };
  }

  // ─── Quota de storage do tenant ─────────────────────────────────────────

  private async validarQuotaStorage(
    tenantId: number,
    bytesNovoArquivo: number,
    limiteGb: number,
  ): Promise<void> {
    if (!limiteGb || limiteGb <= 0) return; // 0 = ilimitado

    const rows = await this.prisma.$queryRawUnsafe<{ total: bigint | null }[]>(
      `SELECT COALESCE(SUM(tamanho_bytes), 0) AS total
       FROM ged_versoes v
       JOIN ged_documentos d ON d.id = v.documento_id
       WHERE v.tenant_id = $1 AND d.deleted_at IS NULL
         AND v.status NOT IN ('CANCELADO', 'OBSOLETO')`,
      tenantId,
    );

    const usadoBytes = Number(rows[0]?.total ?? 0);
    const limiteBytes = limiteGb * 1024 ** 3;
    const disponivel = limiteBytes - usadoBytes;

    if (bytesNovoArquivo > disponivel) {
      const formatGb = (b: number) => (b / 1024 ** 3).toFixed(2);
      throw new BadRequestException(
        `Cota de armazenamento excedida. Usado: ${formatGb(usadoBytes)} GB ` +
          `de ${limiteGb} GB. Arquivo: ${formatGb(bytesNovoArquivo)} GB.`,
      );
    }
  }

  // ─── Nova versão de documento existente ───────────────────────────────────

  async novaVersao(
    tenantId: number,
    userId: number,
    documentoId: number,
    file: Express.Multer.File,
    dto: Omit<UploadDocumentoDto, 'titulo' | 'escopo' | 'codigoCustom' | 'categoriaId' | 'pastaId'>,
    ipOrigem?: string,
  ): Promise<GedUploadResult> {
    this.validarFormatoArquivo(file);

    const docs = await this.prisma.$queryRawUnsafe<GedDocumento[]>(
      `SELECT id, obra_id, codigo FROM ged_documentos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      documentoId,
      tenantId,
    );
    if (!docs.length) throw new NotFoundException(`Documento ${documentoId} não encontrado.`);
    const doc = docs[0];

    // MAX(version) sem FOR UPDATE — Postgres não permite FOR UPDATE em
    // aggregate. A constraint UNIQUE (documento_id, numero_revisao, version)
    // já protege contra race: uploads simultâneos falham com 23505 e podem
    // ser reenviados. Advisory lock por documentoId resolveria totalmente,
    // mas a probabilidade de 2 uploads exatamente simultâneos do mesmo doc
    // é baixa — aceitável por ora.
    const maxVersaoRows = await this.prisma.$queryRawUnsafe<{ max_version: number }[]>(
      `SELECT COALESCE(MAX(version), 0) AS max_version
       FROM ged_versoes
       WHERE documento_id = $1`,
      documentoId,
    );
    const novaVersion = (maxVersaoRows[0]?.max_version ?? 0) + 1;

    const checksum = this.minioService.calcularChecksum(file.buffer);
    const storageKey = this.minioService.buildStorageKey(tenantId, doc.obra_id ?? 0, documentoId, file.originalname);

    await this.minioService.uploadFile(file.buffer, storageKey, file.mimetype);

    const versaoRows = await this.prisma.$queryRawUnsafe<{ id: number; qr_token: string }[]>(
      `INSERT INTO ged_versoes
         (documento_id, tenant_id, numero_revisao, version, status, storage_key, storage_bucket,
          mime_type, tamanho_bytes, checksum_sha256, nome_original, criado_por,
          workflow_template_id, qr_token)
       VALUES ($1, $2, $3, $4, 'RASCUNHO', $5, $6, $7, $8, $9, $10, $11, $12, gen_random_uuid())
       RETURNING id, qr_token`,
      documentoId,
      tenantId,
      dto.numeroRevisao ?? `R${String(novaVersion).padStart(2, '0')}`,
      novaVersion,
      storageKey,
      process.env.MINIO_BUCKET ?? 'eldox-ged',
      file.mimetype,
      file.size,
      checksum,
      file.originalname,
      userId,
      dto.workflowTemplateId ?? null,
    );

    const versaoId = versaoRows[0].id;
    const qrToken = versaoRows[0].qr_token;

    await this.gravarAuditLog({ tenantId, versaoId, userId, acao: 'UPLOAD',
      statusDe: null, statusPara: 'RASCUNHO', ipOrigem,
      detalhes: { documentoId, novaVersion, nomeOriginal: file.originalname } });

    await this.gedQueue.add('ged.ocr', { versaoId, tenantId },
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: true });

    return { documentoId, versaoId, codigoGerado: doc.codigo, status: 'RASCUNHO', qrToken };
  }

  // ─── Buscar versão ────────────────────────────────────────────────────────

  private async buscarVersao(tenantId: number, versaoId: number): Promise<GedVersao & { obra_id: number }> {
    const rows = await this.prisma.$queryRawUnsafe<(GedVersao & { obra_id: number })[]>(
      `SELECT v.*, d.obra_id
       FROM ged_versoes v
       JOIN ged_documentos d ON d.id = v.documento_id
       WHERE v.id = $1 AND d.tenant_id = $2`,
      versaoId,
      tenantId,
    );

    if (!rows.length) throw new NotFoundException(`Versão ${versaoId} não encontrada.`);
    return rows[0];
  }

  // ─── Detalhe da versão ────────────────────────────────────────────────────

  async getVersaoDetalhe(
    tenantId: number,
    versaoId: number,
  ): Promise<GedVersao & { titulo: string; codigo: string; thumbnail_url: string | null }> {
    const rows = await this.prisma.$queryRawUnsafe<
      (GedVersao & { titulo: string; codigo: string; thumbnail_storage_key: string | null })[]
    >(
      `SELECT v.*, d.titulo, d.codigo
       FROM ged_versoes v
       JOIN ged_documentos d ON d.id = v.documento_id
       WHERE v.id = $1 AND d.tenant_id = $2`,
      versaoId,
      tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Versão ${versaoId} não encontrada.`);

    const versao = rows[0];

    // Se o worker ged.thumbnail já produziu a miniatura, devolve uma presigned
    // URL curta. Frontend usa diretamente em <img src>. Se ainda não, retorna
    // null — o frontend cai no mime-icon padrão.
    let thumbnailUrl: string | null = null;
    if (versao.thumbnail_storage_key) {
      try {
        thumbnailUrl = await this.minioService.getPresignedUrl(
          versao.thumbnail_storage_key,
          PRESIGNED_TTL_DOWNLOAD,
        );
      } catch (err) {
        // Nunca deixa um erro de thumbnail quebrar o detalhe da versão —
        // apenas loga e segue com null.
        this.logger.warn(
          `Falha ao gerar presigned thumbnail: versaoId=${versao.id} key=${versao.thumbnail_storage_key} err=${String(err)}`,
        );
      }
    }

    return { ...versao, thumbnail_url: thumbnailUrl };
  }

  // ─── Audit log de uma versão ──────────────────────────────────────────────

  async getAuditLog(tenantId: number, versaoId: number): Promise<unknown[]> {
    return this.prisma.$queryRawUnsafe(
      `SELECT id, acao, status_de, status_para, ip_origem, detalhes, criado_em, usuario_id
       FROM ged_audit_log
       WHERE versao_id = $1 AND tenant_id = $2
       ORDER BY criado_em ASC`,
      versaoId,
      tenantId,
    );
  }

  // ─── Categorias ───────────────────────────────────────────────────────────

  async getCategorias(tenantId: number): Promise<unknown[]> {
    // Retorna categorias do sistema (tenant_id = 0) + categorias do tenant
    return this.prisma.$queryRawUnsafe(
      `SELECT id, tenant_id, nome, codigo, escopo_padrao, requer_aprovacao, prazo_revisao_dias
       FROM ged_categorias
       WHERE (tenant_id = 0 OR tenant_id = $1) AND deleted_at IS NULL
       ORDER BY tenant_id, nome`,
      tenantId,
    );
  }

  // ─── Stats da obra ────────────────────────────────────────────────────────

  async getStats(tenantId: number, obraId: number): Promise<{
    total: number;
    vigentes: number;
    vencendo30dias: number;
  }> {
    const rows = await this.prisma.$queryRawUnsafe<{
      total: string;
      vigentes: string;
      vencendo30dias: string;
    }[]>(
      `SELECT
         COUNT(DISTINCT d.id) AS total,
         COUNT(DISTINCT CASE WHEN v.status IN ('IFC','IFP','AS_BUILT') THEN d.id END) AS vigentes,
         COUNT(DISTINCT CASE
           WHEN v.status IN ('IFC','IFP','AS_BUILT')
             AND v.data_validade IS NOT NULL
             AND v.data_validade <= CURRENT_DATE + INTERVAL '30 days'
             AND v.data_validade >= CURRENT_DATE
           THEN d.id END) AS vencendo30dias
       FROM ged_documentos d
       LEFT JOIN LATERAL (
         SELECT status, data_validade
         FROM ged_versoes
         WHERE documento_id = d.id
         ORDER BY version DESC
         LIMIT 1
       ) v ON true
       WHERE d.tenant_id = $1 AND d.obra_id = $2 AND d.deleted_at IS NULL`,
      tenantId,
      obraId,
    );

    const row = rows[0];
    return {
      total: parseInt(row?.total ?? '0', 10),
      vigentes: parseInt(row?.vigentes ?? '0', 10),
      vencendo30dias: parseInt(row?.vencendo30dias ?? '0', 10),
    };
  }

  // ─── Submeter (RASCUNHO → IFA) ────────────────────────────────────────────

  async submeter(
    tenantId: number,
    userId: number,
    versaoId: number,
    ipOrigem?: string,
  ): Promise<{ versaoId: number; status: GedStatusVersao }> {
    const versao = await this.buscarVersao(tenantId, versaoId);
    this.validarTransicao(versao.status, 'IFA');

    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_versoes SET status = 'IFA' WHERE id = $1`,
      versaoId,
    );

    await this.gravarAuditLog({ tenantId, versaoId, userId, acao: 'SUBMISSAO',
      statusDe: versao.status, statusPara: 'IFA', ipOrigem });

    if (versao.workflow_template_id) {
      await this.workflowService.iniciar(tenantId, versaoId, versao.workflow_template_id, userId);
    }

    this.logger.log(`Versão ${versaoId} submetida: RASCUNHO → IFA`);
    return { versaoId, status: 'IFA' };
  }

  // ─── Aprovar (IFA → IFC | IFP | AS_BUILT) ────────────────────────────────

  async aprovar(
    tenantId: number,
    userId: number,
    versaoId: number,
    dto: AprovarDto,
    ipOrigem?: string,
  ): Promise<{ versaoId: number; status: GedStatusVersao }> {
    const versao = await this.buscarVersao(tenantId, versaoId);
    this.validarTransicao(versao.status, dto.statusAprovado);

    if (versao.criado_por === userId) {
      throw new ForbiddenException(
        'O aprovador não pode ser o mesmo usuário que realizou o upload do documento.',
      );
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_versoes SET status = $1, aprovado_por = $2, aprovado_em = NOW() WHERE id = $3`,
      dto.statusAprovado, userId, versaoId,
    );

    await this.gravarAuditLog({ tenantId, versaoId, userId, acao: 'APROVACAO',
      statusDe: versao.status, statusPara: dto.statusAprovado, ipOrigem,
      detalhes: { comentario: dto.comentario } });

    await this.obsoletarVersoesAnteriores(tenantId, versaoId, versao.documento_id, userId, ipOrigem);

    await this.gravarAuditLog({ tenantId, versaoId, userId, acao: 'VIGENCIA',
      statusDe: dto.statusAprovado, statusPara: dto.statusAprovado, ipOrigem,
      detalhes: { mensagem: 'Documento passou a ser VIGENTE' } });

    this.logger.log(`Versão ${versaoId} aprovada: IFA → ${dto.statusAprovado}`);
    return { versaoId, status: dto.statusAprovado };
  }

  private async obsoletarVersoesAnteriores(
    tenantId: number,
    novaVersaoId: number,
    documentoId: number,
    userId: number,
    ipOrigem?: string,
  ): Promise<void> {
    const versoesVigentes = await this.prisma.$queryRawUnsafe<{ id: number; status: GedStatusVersao }[]>(
      `SELECT v.id, v.status
       FROM ged_versoes v
       JOIN ged_documentos d ON d.id = v.documento_id
       WHERE v.documento_id = $1 AND d.tenant_id = $2 AND v.id != $3
         AND v.status IN ('IFC', 'IFP', 'AS_BUILT')`,
      documentoId, tenantId, novaVersaoId,
    );

    for (const versaoAntiga of versoesVigentes) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes SET status = 'OBSOLETO' WHERE id = $1`, versaoAntiga.id,
      );
      await this.gravarAuditLog({ tenantId, versaoId: versaoAntiga.id, userId, acao: 'OBSOLESCENCIA',
        statusDe: versaoAntiga.status, statusPara: 'OBSOLETO', ipOrigem,
        detalhes: { motivo: 'Nova versão aprovada', novaVersaoId } });
      this.logger.log(`Versão ${versaoAntiga.id} obsoletada por nova aprovação (versão ${novaVersaoId})`);
    }
  }

  // ─── Rejeitar (IFA → REJEITADO) ───────────────────────────────────────────

  async rejeitar(
    tenantId: number,
    userId: number,
    versaoId: number,
    dto: RejeitarDto,
    ipOrigem?: string,
  ): Promise<{ versaoId: number; status: GedStatusVersao }> {
    const versao = await this.buscarVersao(tenantId, versaoId);
    this.validarTransicao(versao.status, 'REJEITADO');

    if (versao.criado_por === userId) {
      throw new ForbiddenException(
        'O responsável pela rejeição não pode ser o mesmo usuário que realizou o upload.',
      );
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_versoes SET status = 'REJEITADO' WHERE id = $1`, versaoId,
    );

    await this.gravarAuditLog({ tenantId, versaoId, userId, acao: 'REJEICAO',
      statusDe: versao.status, statusPara: 'REJEITADO', ipOrigem,
      detalhes: { comentario: dto.comentario } });

    this.logger.log(`Versão ${versaoId} rejeitada com comentário.`);
    return { versaoId, status: 'REJEITADO' };
  }

  // ─── Marcar como Rascunho (REJEITADO → RASCUNHO) ─────────────────────────
  // Permite ao autor retomar a versão após rejeição para corrigir e ressubmeter.

  async marcarRascunho(
    tenantId: number,
    userId: number,
    versaoId: number,
    ipOrigem?: string,
  ): Promise<{ versaoId: number; status: GedStatusVersao }> {
    const versao = await this.buscarVersao(tenantId, versaoId);
    this.validarTransicao(versao.status, 'RASCUNHO');

    // Só o criador volta pra rascunho — aprovador não deve "desrejeitar".
    if (versao.criado_por !== userId) {
      throw new ForbiddenException(
        'Apenas o autor original pode retornar a versão para rascunho.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE ged_versoes SET status = 'RASCUNHO' WHERE id = $1`,
        versaoId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO ged_audit_log
           (tenant_id, versao_id, usuario_id, acao, status_de, status_para, ip_origem, detalhes)
         VALUES ($1, $2, $3, 'WORKFLOW_STEP', $4, 'RASCUNHO', $5, $6::jsonb)`,
        tenantId, versaoId, userId, versao.status, ipOrigem ?? null,
        JSON.stringify({ motivo: 'retorno_pos_rejeicao' }),
      );
    });

    this.logger.log(`Versão ${versaoId} retornou para RASCUNHO.`);
    return { versaoId, status: 'RASCUNHO' };
  }

  // ─── Cancelar (qualquer estado não-final → CANCELADO) ─────────────────────
  // Usado quando um documento é criado por engano ou vira irrelevante antes
  // de se tornar vigente. Estados terminais (IFC/IFP/AS_BUILT/OBSOLETO) não
  // podem ser cancelados — devem ser substituídos por nova versão.

  async cancelar(
    tenantId: number,
    userId: number,
    versaoId: number,
    motivo: string,
    ipOrigem?: string,
  ): Promise<{ versaoId: number; status: GedStatusVersao }> {
    const versao = await this.buscarVersao(tenantId, versaoId);
    this.validarTransicao(versao.status, 'CANCELADO');

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE ged_versoes SET status = 'CANCELADO' WHERE id = $1`,
        versaoId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO ged_audit_log
           (tenant_id, versao_id, usuario_id, acao, status_de, status_para, ip_origem, detalhes)
         VALUES ($1, $2, $3, 'CANCELAMENTO', $4, 'CANCELADO', $5, $6::jsonb)`,
        tenantId, versaoId, userId, versao.status, ipOrigem ?? null,
        JSON.stringify({ motivo }),
      );
    });

    this.logger.log(`Versão ${versaoId} cancelada: ${motivo}`);
    return { versaoId, status: 'CANCELADO' };
  }

  // ─── Download ─────────────────────────────────────────────────────────────

  async download(
    tenantId: number,
    userId: number,
    versaoId: number,
    ipOrigem?: string,
  ): Promise<GedDownloadResult> {
    const versao = await this.buscarVersao(tenantId, versaoId);

    await this.gravarAuditLog({ tenantId, versaoId, userId, acao: 'DOWNLOAD',
      statusDe: versao.status, statusPara: versao.status, ipOrigem,
      detalhes: { nomeOriginal: versao.nome_original, tamanhoBytes: versao.tamanho_bytes } });

    const presignedUrl = await this.minioService.getPresignedUrl(
      versao.storage_key,
      PRESIGNED_TTL_DOWNLOAD,
    );

    return {
      presignedUrl,
      nomeOriginal: versao.nome_original,
      mimeType: versao.mime_type,
      tamanhoBytes: versao.tamanho_bytes,
      expiresInSeconds: PRESIGNED_TTL_DOWNLOAD,
    };
  }

  // ─── Listagem de documentos ───────────────────────────────────────────────

  async listarDocumentos(
    tenantId: number,
    obraId: number | null,
    dto: ListDocumentosDto,
  ): Promise<{ items: GedDocumento[]; total: number; page: number; totalPages: number }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    const params: (string | number | null)[] = [tenantId];
    const conditions: string[] = [
      `d.tenant_id = $1`,
      `d.deleted_at IS NULL`,
    ];

    if (obraId !== null) {
      params.push(obraId);
      conditions.push(`d.obra_id = $${params.length}`);
    } else {
      // Nível empresa: documentos sem obra ou escopo EMPRESA
      conditions.push(`(d.obra_id IS NULL OR d.escopo = 'EMPRESA')`);
    }

    // Busca genérica por título ou código
    if (dto.q) {
      params.push(`%${dto.q}%`);
      conditions.push(`(d.titulo ILIKE $${params.length} OR d.codigo ILIKE $${params.length})`);
    }
    if (dto.titulo) {
      params.push(`%${dto.titulo}%`);
      conditions.push(`d.titulo ILIKE $${params.length}`);
    }
    if (dto.codigo) {
      params.push(`%${dto.codigo}%`);
      conditions.push(`d.codigo ILIKE $${params.length}`);
    }
    if (dto.disciplina) {
      params.push(dto.disciplina);
      conditions.push(`d.disciplina = $${params.length}`);
    }
    if (dto.escopo) {
      params.push(dto.escopo);
      conditions.push(`d.escopo = $${params.length}`);
    }
    if (dto.pastaId) {
      params.push(dto.pastaId);
      conditions.push(`d.pasta_id = $${params.length}`);
    }
    if (dto.categoriaId) {
      params.push(dto.categoriaId);
      conditions.push(`d.categoria_id = $${params.length}`);
    }
    if (dto.status) {
      params.push(dto.status);
      conditions.push(`v.status = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const queryBase = `
      FROM ged_documentos d
      LEFT JOIN LATERAL (
        SELECT id, status, numero_revisao, version, data_validade, aprovado_em,
               aprovado_por, tamanho_bytes, mime_type
        FROM ged_versoes
        WHERE documento_id = d.id
        ORDER BY version DESC
        LIMIT 1
      ) v ON true
      LEFT JOIN ged_categorias c ON c.id = d.categoria_id
      WHERE ${whereClause}
    `;

    const countRows = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count ${queryBase}`,
      ...params,
    );
    const total = parseInt(countRows[0]?.count ?? '0', 10);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    params.push(limit, offset);
    type RawRow = {
      id: number; titulo: string; codigo: string; disciplina: string | null;
      escopo: string; obra_id: number | null; pasta_id: number | null;
      categoria_id: number | null; tags: string[] | null;
      versao_atual_id: number | null; versao_atual_status: string | null;
      versao_atual_numero: string | null; versao_atual_version: number | null;
      versao_atual_validade: Date | null; versao_atual_aprovado_em: Date | null;
      versao_atual_aprovado_por: number | null;
      versao_atual_tamanho: bigint | number | null; versao_atual_mime: string | null;
      categoria_nome: string | null; categoria_codigo: string | null;
    };
    const rawItems = await this.prisma.$queryRawUnsafe<RawRow[]>(
      `SELECT d.id, d.titulo, d.codigo, d.disciplina, d.escopo, d.obra_id,
              d.pasta_id, d.categoria_id, d.tags,
              v.id          AS versao_atual_id,
              v.status      AS versao_atual_status,
              v.numero_revisao AS versao_atual_numero,
              v.version     AS versao_atual_version,
              v.data_validade AS versao_atual_validade,
              v.aprovado_em AS versao_atual_aprovado_em,
              v.aprovado_por AS versao_atual_aprovado_por,
              v.tamanho_bytes AS versao_atual_tamanho,
              v.mime_type   AS versao_atual_mime,
              c.nome        AS categoria_nome,
              c.codigo      AS categoria_codigo
       ${queryBase}
       ORDER BY d.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    );

    // Mapeia snake_case → camelCase e aninha versaoAtual + categoria para
    // bater com o contrato do frontend (ged.service.ts). Sem isso, a grade de
    // documentos crasha lendo `doc.versaoAtual.status` (undefined).
    const items = rawItems.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      codigo: r.codigo,
      disciplina: r.disciplina,
      escopo: r.escopo,
      obraId: r.obra_id ?? undefined,
      pastaId: r.pasta_id,
      categoriaId: r.categoria_id,
      tags: r.tags ?? undefined,
      categoria: r.categoria_id != null ? {
        id: r.categoria_id,
        nome: r.categoria_nome ?? '',
        codigo: r.categoria_codigo ?? '',
      } : null,
      versaoAtual: r.versao_atual_id != null ? {
        id: r.versao_atual_id,
        numeroRevisao: r.versao_atual_numero ?? '0',
        version: r.versao_atual_version ?? 1,
        status: r.versao_atual_status ?? 'RASCUNHO',
        aprovadoEm: r.versao_atual_aprovado_em ?? undefined,
        aprovadoPor: r.versao_atual_aprovado_por ?? undefined,
        tamanhoBytes: r.versao_atual_tamanho != null ? Number(r.versao_atual_tamanho) : 0,
        mimeType: r.versao_atual_mime ?? '',
        dataValidade: r.versao_atual_validade ?? undefined,
      } : null,
    }));

    return { items: items as unknown as GedDocumento[], total, page, totalPages };
  }

  // ─── Lista Mestra ─────────────────────────────────────────────────────────

  async listaMestra(tenantId: number, obraId: number): Promise<GedListaMestraItem[]> {
    return this.prisma.$queryRawUnsafe<GedListaMestraItem[]>(
      `SELECT
         d.id AS documento_id,
         d.titulo,
         d.codigo,
         d.disciplina,
         p.path AS pasta_path,
         v.id AS versao_id,
         v.numero_revisao,
         v.version,
         v.status,
         v.aprovado_por,
         v.aprovado_em,
         v.qr_token
       FROM ged_documentos d
       JOIN ged_versoes v ON v.documento_id = d.id
       LEFT JOIN ged_pastas p ON p.id = d.pasta_id
       WHERE d.tenant_id = $1
         AND d.obra_id = $2
         AND d.deleted_at IS NULL
         AND v.status IN ('IFC', 'IFP', 'AS_BUILT')
       ORDER BY d.disciplina, d.codigo, v.version DESC`,
      tenantId,
      obraId,
    );
  }

  /**
   * Lista mestra agrupada por categoria, no shape rico consumido pelo frontend
   * (GedListaMestraPage). Retorna:
   *   - obra { id, nome, codigo }
   *   - modoAuditoria (de ged_configuracoes.modo_auditoria)
   *   - geradoEm (ISO)
   *   - categorias: [{ id, codigo, nome, documentos: [...] }]
   *
   * Usa apenas a versão mais recente VIGENTE (IFC/IFP/AS_BUILT) de cada documento.
   * Mantém-se paralelo ao método `listaMestra()` que continua servindo ao export.
   */
  async listaMestraAgrupada(tenantId: number, obraId: number): Promise<{
    obra: { id: number; nome: string; codigo: string | null };
    modoAuditoria: boolean;
    geradoEm: string;
    categorias: Array<{
      id: number;
      codigo: string;
      nome: string;
      documentos: Array<{
        codigo: string;
        titulo: string;
        numeroRevisao: string;
        aprovadoEm: string;
        aprovadoPor: string;
        dataValidade?: string;
        alertaVencimento: boolean;
      }>;
    }>;
  }> {
    const [obraRows, configRows, rows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ id: number; nome: string; codigo: string | null }>>(
        `SELECT id, nome, codigo FROM "Obra" WHERE id = $1 AND "tenantId" = $2`,
        obraId,
        tenantId,
      ),
      this.prisma.$queryRawUnsafe<Array<{ modo_auditoria: boolean }>>(
        `SELECT modo_auditoria FROM ged_configuracoes WHERE tenant_id = $1`,
        tenantId,
      ),
      this.prisma.$queryRawUnsafe<Array<{
        documento_id: number;
        categoria_id: number;
        categoria_codigo: string;
        categoria_nome: string;
        titulo: string;
        codigo: string;
        numero_revisao: string;
        aprovado_em: Date | null;
        aprovado_por_nome: string | null;
        data_validade: Date | null;
      }>>(
        `SELECT DISTINCT ON (d.id)
           d.id                AS documento_id,
           d.categoria_id,
           c.codigo            AS categoria_codigo,
           c.nome              AS categoria_nome,
           d.titulo,
           d.codigo,
           v.numero_revisao,
           v.aprovado_em,
           u.nome              AS aprovado_por_nome,
           v.data_validade
         FROM ged_documentos d
         JOIN ged_versoes v    ON v.documento_id = d.id
         JOIN ged_categorias c ON c.id = d.categoria_id
         LEFT JOIN "Usuario" u ON u.id = v.aprovado_por
         WHERE d.tenant_id = $1
           AND d.obra_id = $2
           AND d.deleted_at IS NULL
           AND v.status IN ('IFC', 'IFP', 'AS_BUILT')
         ORDER BY d.id, v.version DESC`,
        tenantId,
        obraId,
      ),
    ]);

    if (!obraRows.length) {
      throw new NotFoundException('Obra não encontrada');
    }

    const hoje = new Date();
    const limiteAlerta = new Date();
    limiteAlerta.setDate(hoje.getDate() + 30);

    const categoriasMap = new Map<number, {
      id: number;
      codigo: string;
      nome: string;
      documentos: Array<{
        codigo: string;
        titulo: string;
        numeroRevisao: string;
        aprovadoEm: string;
        aprovadoPor: string;
        dataValidade?: string;
        alertaVencimento: boolean;
      }>;
    }>();

    for (const r of rows) {
      if (!categoriasMap.has(r.categoria_id)) {
        categoriasMap.set(r.categoria_id, {
          id: r.categoria_id,
          codigo: r.categoria_codigo,
          nome: r.categoria_nome,
          documentos: [],
        });
      }
      const validade = r.data_validade ? new Date(r.data_validade) : null;
      const alertaVencimento =
        validade != null && validade <= limiteAlerta;

      categoriasMap.get(r.categoria_id)!.documentos.push({
        codigo: r.codigo,
        titulo: r.titulo,
        numeroRevisao: r.numero_revisao,
        aprovadoEm: r.aprovado_em ? new Date(r.aprovado_em).toISOString() : '',
        aprovadoPor: r.aprovado_por_nome ?? '—',
        dataValidade: validade ? validade.toISOString() : undefined,
        alertaVencimento,
      });
    }

    // Ordena categorias por código e documentos por código
    const categorias = Array.from(categoriasMap.values())
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .map((c) => ({
        ...c,
        documentos: c.documentos.sort((a, b) => a.codigo.localeCompare(b.codigo)),
      }));

    return {
      obra: obraRows[0],
      modoAuditoria: configRows[0]?.modo_auditoria ?? false,
      geradoEm: new Date().toISOString(),
      categorias,
    };
  }

  // ─── QR Code (público, sem JWT) ───────────────────────────────────────────

  async consultaQr(qrToken: string, ipOrigem?: string): Promise<{
    documento: Partial<GedDocumento>;
    versao: Partial<GedVersao>;
    presignedUrl: string;
  }> {
    const rows = await this.prisma.$queryRawUnsafe<
      (GedVersao & { tenant_id: number; titulo: string; codigo: string; disciplina: string })[]
    >(
      `SELECT v.*, d.tenant_id, d.titulo, d.codigo, d.disciplina
       FROM ged_versoes v
       JOIN ged_documentos d ON d.id = v.documento_id
       WHERE v.qr_token = $1`,
      qrToken,
    );

    if (!rows.length) throw new NotFoundException('QR Code inválido ou expirado.');

    const versao = rows[0];

    await this.gravarAuditLog({ tenantId: versao.tenant_id, versaoId: versao.id,
      userId: 0, acao: 'QR_SCAN', statusDe: versao.status, statusPara: versao.status,
      ipOrigem, detalhes: { qrToken } });

    const presignedUrl = await this.minioService.getPresignedUrl(versao.storage_key, PRESIGNED_TTL_QR);

    return {
      documento: { id: versao.documento_id, titulo: versao.titulo, codigo: versao.codigo, disciplina: versao.disciplina },
      versao: { id: versao.id, numero_revisao: versao.numero_revisao, version: versao.version,
        status: versao.status, aprovado_por: versao.aprovado_por, aprovado_em: versao.aprovado_em,
        nome_original: versao.nome_original, tamanho_bytes: versao.tamanho_bytes, mime_type: versao.mime_type },
      presignedUrl,
    };
  }

  // ─── Utilitário: URL temporária para storage key (sem audit log) ──────────
  async getStorageUrl(storageKey: string, ttlSeconds = 3600): Promise<string> {
    return this.minioService.getPresignedUrl(storageKey, ttlSeconds);
  }
}
