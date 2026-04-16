// backend/src/ensaios/ensaios.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../ged/storage/minio.service';
import type { CreateEnsaioDto, ListarEnsaiosQuery } from './dto/create-ensaio.dto';

const MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const MAX_ARQUIVO_BYTES = 25 * 1024 * 1024; // 25 MB

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** Valida assinatura binária (magic bytes) — prevenção de upload de tipo mascarado */
function detectarMimePorBytes(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'; // %PDF
  if (buf[0] === 0xFF && buf[1] === 0xD8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';  // ‰PNG
  return null;
}

interface EnsaioTipo {
  id: number;
  tenant_id: number;
  ativo: boolean;
  valor_ref_min: number | null;
  valor_ref_max: number | null;
  norma_tecnica: string | null;
  unidade_frequencia: string | null;
  freq_valor: number | null;
}

@Injectable()
export class EnsaiosService {
  private readonly logger = new Logger(EnsaiosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    @InjectQueue('ensaios') private readonly ensaiosQueue: Queue,
  ) {}

  // ── Audit log ─────────────────────────────────────────────────────────────

  private auditLog(tenantId: number, userId: number, acao: string, entidade: string, entidadeId: number, detalhes: object): void {
    this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, detalhes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      tenantId, userId, acao, entidade, entidadeId, JSON.stringify(detalhes),
    ).catch(() => {
      this.logger.error(JSON.stringify({
        audit: true, tenant_id: tenantId, usuario_id: userId,
        acao, entidade, entidade_id: entidadeId, detalhes,
      }));
    });
  }

  // ── POST /ensaios ─────────────────────────────────────────────────────────

  async criarEnsaio(tenantId: number, userId: number, dto: CreateEnsaioDto) {
    // 1. Validar fvm_lote — 2-query: first sem tenant (404 se inexistente), depois checa tenant (403 se cross-tenant)
    const loteRows = await this.prisma.$queryRawUnsafe<{ id: number; tenant_id: number }[]>(
      `SELECT id, tenant_id FROM fvm_lotes WHERE id = $1`,
      dto.fvm_lote_id,
    );
    if (!loteRows.length) throw new NotFoundException('Lote não encontrado');
    if (loteRows[0].tenant_id !== tenantId) throw new ForbiddenException('Acesso negado');

    // 2. Validar laboratório
    const labRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM laboratorios WHERE id = $1 AND ativo = TRUE AND tenant_id = $2`,
      dto.laboratorio_id, tenantId,
    );
    if (!labRows.length) throw new NotFoundException('Laboratório não disponível');

    // 3. Validar data_ensaio não futura
    const dataEnsaio = new Date(dto.data_ensaio);
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    if (dataEnsaio > hoje) {
      throw new BadRequestException('data_ensaio não pode ser uma data futura');
    }

    // 4. Validar cada resultado e buscar tipos
    const tiposValidados: EnsaioTipo[] = [];
    for (const resultado of dto.resultados) {
      const tipoRows = await this.prisma.$queryRawUnsafe<EnsaioTipo[]>(
        `SELECT t.id, t.tenant_id, t.ativo, t.valor_ref_min, t.valor_ref_max, t.norma_tecnica,
                f.unidade_frequencia, f.valor AS freq_valor
         FROM ensaio_tipo t
         LEFT JOIN ensaio_frequencia f ON f.ensaio_tipo_id = t.id AND f.tenant_id = t.tenant_id
         WHERE t.id = $1 AND t.tenant_id = $2`,
        resultado.ensaio_tipo_id, tenantId,
      );
      if (!tipoRows.length) throw new NotFoundException(`Tipo de ensaio ${resultado.ensaio_tipo_id} não encontrado`);
      if (!tipoRows[0].ativo) throw new BadRequestException(`Tipo de ensaio ${resultado.ensaio_tipo_id} está inativo`);
      tiposValidados.push(tipoRows[0]);
    }

    // 5. Validar arquivo se informado — bytes reais validados (não apenas string de mime_type)
    if (dto.arquivo) {
      const buffer = Buffer.from(dto.arquivo.base64, 'base64');
      if (buffer.length > MAX_ARQUIVO_BYTES) {
        throw new BadRequestException('Arquivo excede o limite de 25 MB');
      }
      const mimeReal = detectarMimePorBytes(buffer);
      if (!mimeReal || mimeReal !== dto.arquivo.mime_type) {
        throw new BadRequestException('Tipo de arquivo inválido ou incompatível com o conteúdo enviado');
      }
    }

    // 6. Calcular aprovado_auto por resultado
    const resultadosComAprovacao = dto.resultados.map((resultado, idx) => {
      const tipo = tiposValidados[idx];
      let aprovado_auto: boolean | null = null;
      if (tipo.valor_ref_min != null || tipo.valor_ref_max != null) {
        const acimMin = tipo.valor_ref_min == null || resultado.valor_obtido >= tipo.valor_ref_min;
        const abaixMax = tipo.valor_ref_max == null || resultado.valor_obtido <= tipo.valor_ref_max;
        aprovado_auto = acimMin && abaixMax;
      }
      return { ...resultado, aprovado_auto };
    });

    // 7-13. INSERT ensaio + resultados + arquivo + revisao — rollback manual se upload falhar
    let ensaioId: number | null = null;
    const resultadosInseridos: { id: number; ensaio_tipo_id: number; valor_obtido: number; aprovado_auto: boolean | null }[] = [];
    let revisaoId: number;
    let proximoEnsaioData: string | null = null;

    try {
      // 7. INSERT ensaio_laboratorial
      // ia_confianca e ia_extraido_em incluídos condicionalmente via CASE WHEN
      const ensaioRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO ensaio_laboratorial
           (tenant_id, obra_id, fvm_lote_id, laboratorio_id, data_ensaio, nota_fiscal_ref, observacoes, criado_por,
            ia_confianca, ia_extraido_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 $9::numeric,
                 CASE WHEN $9::numeric IS NOT NULL THEN NOW() ELSE NULL END)
         RETURNING id`,
        tenantId, dto.obra_id, dto.fvm_lote_id, dto.laboratorio_id,
        dto.data_ensaio, dto.nota_fiscal_ref ?? null, dto.observacoes ?? null, userId,
        dto.ia_confianca ?? null,
      );
      ensaioId = ensaioRows[0].id;

      // 8. INSERT ensaio_resultado[]
      for (const res of resultadosComAprovacao) {
        const resRows = await this.prisma.$queryRawUnsafe<{ id: number; ensaio_tipo_id: number; valor_obtido: number; aprovado_auto: boolean | null }[]>(
          `INSERT INTO ensaio_resultado (tenant_id, ensaio_id, ensaio_tipo_id, valor_obtido, aprovado_auto, observacao)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, ensaio_tipo_id, valor_obtido, aprovado_auto`,
          tenantId, ensaioId, res.ensaio_tipo_id, res.valor_obtido, res.aprovado_auto, res.observacao ?? null,
        );
        resultadosInseridos.push(resRows[0]);
      }

      // 9. Upload de arquivo se informado — extensão derivada do MIME real (não do cliente)
      if (dto.arquivo) {
        const buffer = Buffer.from(dto.arquivo.base64, 'base64');
        const ext = MIME_TO_EXT[dto.arquivo.mime_type] ?? '.bin';
        const randomName = crypto.randomBytes(16).toString('hex');
        const storageKey = `ensaios/${tenantId}/${ensaioId}/${randomName}${ext}`;
        const hash = this.minio.calcularChecksum(buffer);

        // Pode lançar — se falhar, o catch abaixo faz rollback do ensaio
        const uploadResult = await this.minio.uploadFile(buffer, storageKey, dto.arquivo.mime_type);

        await this.prisma.$executeRawUnsafe(
          `INSERT INTO ensaio_arquivo
             (tenant_id, ensaio_id, nome_original, nome_storage, bucket, content_type, tamanho_bytes, hash, upload_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          tenantId, ensaioId, dto.arquivo.nome_original, storageKey,
          uploadResult.bucket, dto.arquivo.mime_type, buffer.length, hash, userId,
        );
      }

      // 10. Calcular proximo_ensaio_data usando o tipo do primeiro resultado
      const tiposPrincipal = tiposValidados[0];
      if (tiposPrincipal.unidade_frequencia === 'dias' && tiposPrincipal.freq_valor != null) {
        const data = new Date(dto.data_ensaio);
        data.setDate(data.getDate() + tiposPrincipal.freq_valor);
        proximoEnsaioData = data.toISOString().split('T')[0];
      }

      // 11. UPDATE ensaio_laboratorial com proximo_ensaio_data
      await this.prisma.$executeRawUnsafe(
        `UPDATE ensaio_laboratorial SET proximo_ensaio_data = $1, updated_at = NOW() WHERE id = $2`,
        proximoEnsaioData, ensaioId,
      );

      // 12. Determinar prioridade revisão
      const algumReprovado = resultadosComAprovacao.some(r => r.aprovado_auto === false);
      const prioridade = algumReprovado ? 'alta' : 'normal';

      // 13. INSERT ensaio_revisao
      const revisaoRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO ensaio_revisao (tenant_id, ensaio_id, situacao, prioridade)
         VALUES ($1, $2, 'PENDENTE', $3)
         RETURNING id`,
        tenantId, ensaioId, prioridade,
      );
      revisaoId = revisaoRows[0].id;

    } catch (err) {
      // Rollback: CASCADE ON DELETE propaga para ensaio_resultado, ensaio_arquivo e ensaio_revisao
      if (ensaioId !== null) {
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM ensaio_laboratorial WHERE id = $1 AND tenant_id = $2`,
          ensaioId, tenantId,
        ).catch((e) => this.logger.error(`Rollback falhou para ensaio ${ensaioId}: ${e}`));
      }
      throw err;
    }

    // 14. Agendar BullMQ job para alerta de próximo cupom
    if (proximoEnsaioData) {
      const alertaData = new Date(proximoEnsaioData);
      alertaData.setDate(alertaData.getDate() - 3);
      const delay = alertaData.getTime() - Date.now();

      if (delay > 0) {
        await this.ensaiosQueue.add(
          'alerta-proximo-cupom',
          { ensaioId, tenantId, proximoEnsaioData },
          { jobId: `ensaio-alerta-${ensaioId}`, delay },
        );
      } else {
        this.logger.warn(`Ensaio ${ensaioId}: próximo cupom já próximo/vencido — job BullMQ não agendado`);
      }
    }

    // 15. Audit log
    this.auditLog(tenantId, userId, 'ENSAIO_CRIADO', 'ensaio_laboratorial', ensaioId!, {
      obra_id: dto.obra_id, fvm_lote_id: dto.fvm_lote_id, laboratorio_id: dto.laboratorio_id,
    });

    return {
      id: ensaioId!,
      proximo_ensaio_data: proximoEnsaioData,
      revisao_id: revisaoId!,
      resultados: resultadosInseridos,
    };
  }

  // ── GET /ensaios ──────────────────────────────────────────────────────────

  async listarEnsaios(tenantId: number, query: ListarEnsaiosQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['e.tenant_id = $1', 'e.obra_id = $2'];
    const params: unknown[] = [tenantId, query.obra_id];
    let i = 3;

    if (query.fvm_lote_id) {
      conditions.push(`e.fvm_lote_id = $${i++}`);
      params.push(query.fvm_lote_id);
    }

    if (query.situacao_revisao) {
      conditions.push(`r.situacao = $${i++}`);
      params.push(query.situacao_revisao);
    }

    const where = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT
         e.id, e.obra_id, e.fvm_lote_id, e.laboratorio_id, e.data_ensaio,
         e.nota_fiscal_ref, e.proximo_ensaio_data, e.proximo_ensaio_alertado,
         e.observacoes, e.ia_extraido_em, e.ia_confianca, e.criado_por, e.created_at, e.updated_at,
         l.nome AS laboratorio_nome,
         r.id AS revisao_id, r.situacao AS revisao_situacao, r.prioridade AS revisao_prioridade,
         CASE
           WHEN e.proximo_ensaio_data IS NOT NULL
           THEN (e.proximo_ensaio_data - NOW()::date)::int
           ELSE NULL
         END AS dias_para_proximo_cupom
       FROM ensaio_laboratorial e
       JOIN laboratorios l ON l.id = e.laboratorio_id
       LEFT JOIN ensaio_revisao r ON r.ensaio_id = e.id
       WHERE ${where}
       ORDER BY e.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      ...params, limit, offset,
    );

    const countRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total
       FROM ensaio_laboratorial e
       LEFT JOIN ensaio_revisao r ON r.ensaio_id = e.id
       WHERE ${where}`,
      ...params.slice(0, i - 3),
    );

    return {
      items: rows,
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
    };
  }

  // ── GET /ensaios/:id ──────────────────────────────────────────────────────

  async buscarEnsaio(tenantId: number, id: number) {
    const ensaioRows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT
         e.*,
         l.nome AS laboratorio_nome, l.cnpj AS laboratorio_cnpj, l.contato AS laboratorio_contato,
         r.id AS revisao_id, r.situacao AS revisao_situacao, r.prioridade AS revisao_prioridade,
         r.revisado_por, r.observacao AS revisao_observacao, r.revisado_em,
         CASE
           WHEN e.proximo_ensaio_data IS NOT NULL
           THEN (e.proximo_ensaio_data - NOW()::date)::int
           ELSE NULL
         END AS dias_para_proximo_cupom
       FROM ensaio_laboratorial e
       JOIN laboratorios l ON l.id = e.laboratorio_id
       LEFT JOIN ensaio_revisao r ON r.ensaio_id = e.id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      id, tenantId,
    );

    if (!ensaioRows.length) throw new NotFoundException(`Ensaio ${id} não encontrado`);

    const ensaio = ensaioRows[0] as Record<string, unknown>;

    // Buscar resultados
    const resultados = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT er.*, et.nome AS tipo_nome, et.unidade, et.norma_tecnica
       FROM ensaio_resultado er
       JOIN ensaio_tipo et ON et.id = er.ensaio_tipo_id
       WHERE er.ensaio_id = $1 AND er.tenant_id = $2`,
      id, tenantId,
    );

    // Buscar arquivo e gerar presigned URL se existir
    const arquivoRows = await this.prisma.$queryRawUnsafe<{ id: number; nome_original: string; nome_storage: string; bucket: string; content_type: string; tamanho_bytes: number; hash: string; upload_por: number; created_at: Date }[]>(
      `SELECT * FROM ensaio_arquivo WHERE ensaio_id = $1 AND tenant_id = $2 LIMIT 1`,
      id, tenantId,
    );

    let arquivo: (typeof arquivoRows[0] & { url_presignada?: string }) | null = null;
    if (arquivoRows.length) {
      const url_presignada = await this.minio.getPresignedUrl(arquivoRows[0].nome_storage, 600);
      arquivo = { ...arquivoRows[0], url_presignada };
    }

    return { ...ensaio, resultados, arquivo };
  }
}
