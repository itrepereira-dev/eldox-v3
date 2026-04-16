// backend/src/ensaios/revisoes/revisoes.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecebimentoService } from '../../fvm/recebimento/recebimento.service';
import { DecisaoQuarentena } from '../../fvm/recebimento/dto/liberar-quarentena.dto';
import { SituacaoRevisao, RevisarLaudoDto } from '../dto/revisar-laudo.dto';
import { AlertasService } from '../alertas/alertas.service';

interface ListarRevisoesQuery {
  obra_id: number;
  situacao?: string;
  prioridade?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class RevisoesService {
  private readonly logger = new Logger(RevisoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recebimentoService: RecebimentoService,
    private readonly alertasService: AlertasService,
  ) {}

  // ── Audit log ─────────────────────────────────────────────────────────────

  private auditLog(
    tenantId: number,
    userId: number,
    acao: string,
    entidade: string,
    entidadeId: number,
    detalhes: object,
  ): void {
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

  // ── GET /ensaios/revisoes ─────────────────────────────────────────────────

  async listarRevisoes(tenantId: number, query: ListarRevisoesQuery) {
    const page  = query.page  ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['r.tenant_id = $1', 'e.obra_id = $2'];
    const params: unknown[] = [tenantId, query.obra_id];
    let i = 3;

    if (query.situacao) {
      conditions.push(`r.situacao = $${i++}`);
      params.push(query.situacao);
    }
    if (query.prioridade) {
      conditions.push(`r.prioridade = $${i++}`);
      params.push(query.prioridade);
    }

    const where = conditions.join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT
         r.id, r.ensaio_id, r.situacao, r.prioridade, r.revisado_por, r.observacao,
         r.revisado_em, r.created_at, r.updated_at,
         e.obra_id, e.fvm_lote_id, e.laboratorio_id, e.data_ensaio, e.proximo_ensaio_data,
         l.nome AS laboratorio_nome,
         fl.numero_lote AS lote_numero, fl.status AS lote_status,
         m.nome AS material_nome,
         f.razao_social AS fornecedor_nome,
         CASE WHEN r.prioridade = 'alta' THEN 1 ELSE 0 END AS prioridade_order
       FROM ensaio_revisao r
       JOIN ensaio_laboratorial e ON e.id = r.ensaio_id AND e.tenant_id = r.tenant_id
       JOIN laboratorios l ON l.id = e.laboratorio_id
       JOIN fvm_lotes fl ON fl.id = e.fvm_lote_id
       JOIN fvm_catalogo_materiais m ON m.id = fl.material_id
       JOIN fvm_fornecedores f ON f.id = fl.fornecedor_id
       WHERE ${where}
       ORDER BY prioridade_order DESC, e.data_ensaio ASC
       LIMIT $${i++} OFFSET $${i++}`,
      ...params, limit, offset,
    );

    const countRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total
       FROM ensaio_revisao r
       JOIN ensaio_laboratorial e ON e.id = r.ensaio_id AND e.tenant_id = r.tenant_id
       WHERE ${where}`,
      ...params.slice(0, i - 2),
    );

    return {
      items: rows,
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
    };
  }

  // ── GET /ensaios/revisoes/:id ─────────────────────────────────────────────

  async buscarRevisao(tenantId: number, id: number) {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number; tenant_id: number; situacao: string; ensaio_id: number; [key: string]: unknown }[]>(
      `SELECT
         r.id, r.tenant_id, r.ensaio_id, r.situacao, r.prioridade, r.revisado_por, r.observacao,
         r.revisado_em, r.created_at, r.updated_at,
         e.obra_id, e.fvm_lote_id, e.laboratorio_id, e.data_ensaio, e.proximo_ensaio_data,
         e.nota_fiscal_ref, e.observacoes, e.ia_extraido_em, e.ia_confianca,
         l.nome AS laboratorio_nome, l.cnpj AS laboratorio_cnpj, l.contato AS laboratorio_contato,
         fl.numero_lote AS lote_numero, fl.status AS lote_status,
         m.nome AS material_nome,
         f.razao_social AS fornecedor_nome,
         CASE WHEN r.prioridade = 'alta' THEN 1 ELSE 0 END AS prioridade_order
       FROM ensaio_revisao r
       JOIN ensaio_laboratorial e ON e.id = r.ensaio_id AND e.tenant_id = r.tenant_id
       JOIN laboratorios l ON l.id = e.laboratorio_id
       JOIN fvm_lotes fl ON fl.id = e.fvm_lote_id
       JOIN fvm_catalogo_materiais m ON m.id = fl.material_id
       JOIN fvm_fornecedores f ON f.id = fl.fornecedor_id
       WHERE r.id = $1 AND r.tenant_id = $2`,
      id, tenantId,
    );

    if (!rows.length) throw new NotFoundException('Revisão não encontrada');

    const revisao = rows[0] as Record<string, unknown>;

    // Buscar resultados com tipo
    const resultados = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT er.*, et.nome AS tipo_nome, et.unidade, et.norma_tecnica
       FROM ensaio_resultado er
       JOIN ensaio_tipo et ON et.id = er.ensaio_tipo_id
       WHERE er.ensaio_id = $1 AND er.tenant_id = $2`,
      revisao['ensaio_id'], tenantId,
    );

    // Buscar histórico
    const historico = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT *
       FROM ensaio_revisao_historico
       WHERE ensaio_revisao_id = $1 AND tenant_id = $2
       ORDER BY created_at ASC`,
      id, tenantId,
    );

    return { ...revisao, resultados, historico };
  }

  // ── PATCH /ensaios/revisoes/:id ───────────────────────────────────────────

  async revisarLaudo(
    tenantId: number,
    userId: number,
    role: string,
    id: number,
    dto: RevisarLaudoDto,
  ): Promise<{ id: number; situacao: SituacaoRevisao; revisado_em: Date }> {
    // 1. Buscar revisão
    const revisaoRows = await this.prisma.$queryRawUnsafe<{
      id: number; tenant_id: number; situacao: string; ensaio_id: number;
    }[]>(
      `SELECT id, tenant_id, situacao, ensaio_id FROM ensaio_revisao WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!revisaoRows.length) throw new NotFoundException('Revisão não encontrada');

    const revisao = revisaoRows[0];

    // 2. Buscar ensaio
    const ensaioRows = await this.prisma.$queryRawUnsafe<{
      fvm_lote_id: number; obra_id: number;
    }[]>(
      `SELECT fvm_lote_id, obra_id FROM ensaio_laboratorial WHERE id = $1 AND tenant_id = $2`,
      revisao.ensaio_id, tenantId,
    );
    // Ensaio deve existir (integridade referencial garantida na criação)
    const ensaio = ensaioRows[0];

    // 3. Buscar lote
    const loteRows = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM fvm_lotes WHERE id = $1 AND tenant_id = $2`,
      ensaio.fvm_lote_id, tenantId,
    );
    const lote = loteRows[0];

    // 4. Regras de transição
    if (dto.reabrir === true) {
      // Somente ADMIN_TENANT pode reabrir
      if (role !== 'ADMIN_TENANT') {
        throw new ForbiddenException('Somente ADMIN_TENANT pode reabrir uma revisão');
      }
      // situacao deve ser PENDENTE quando reabrindo
      if (dto.situacao !== SituacaoRevisao.PENDENTE) {
        throw new BadRequestException('Ao reabrir, situacao deve ser PENDENTE');
      }
      // Revisão precisa estar APROVADO ou REPROVADO para poder reabrir
      if (revisao.situacao === 'PENDENTE') {
        throw new ConflictException('Revisão já está PENDENTE — não é possível reabrir');
      }
    } else {
      // Revisão normal: situacao deve ser APROVADO ou REPROVADO
      if (dto.situacao === SituacaoRevisao.PENDENTE) {
        throw new BadRequestException('situacao deve ser APROVADO ou REPROVADO');
      }
      // Revisão já concluída
      if (revisao.situacao === 'APROVADO' || revisao.situacao === 'REPROVADO') {
        throw new ConflictException('Laudo já foi revisado');
      }
    }

    // Observação obrigatória para REPROVADO
    if (dto.situacao === SituacaoRevisao.REPROVADO && !dto.observacao?.trim()) {
      throw new BadRequestException('Observação obrigatória para reprovação');
    }

    const situacaoAnterior = revisao.situacao;

    // 5. UPDATE ensaio_revisao
    await this.prisma.$executeRawUnsafe(
      `UPDATE ensaio_revisao
       SET situacao = $1, revisado_por = $2, observacao = $3,
           revisado_em = NOW(), updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      dto.situacao, userId, dto.observacao ?? null, id, tenantId,
    );

    // 6. INSERT ensaio_revisao_historico
    const tipoEvento = dto.reabrir ? 'REABERTURA' : 'REVISAO';
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ensaio_revisao_historico
         (tenant_id, ensaio_revisao_id, situacao_anterior, situacao_nova, tipo_evento, usuario_id, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      tenantId, id, situacaoAnterior, dto.situacao, tipoEvento, userId, dto.observacao ?? null,
    );

    // 7. Se reabrindo E lote não está em quarentena — apenas audit warn (não reverte lote)
    if (dto.reabrir === true && lote?.status !== 'quarentena') {
      this.auditLog(tenantId, userId, 'REVISAO_REABERTA', 'ensaio_revisao', id, {
        ensaio_id: revisao.ensaio_id,
        fvm_lote_id: ensaio.fvm_lote_id,
        lote_status: lote?.status ?? null,
        nivel: 'WARN',
      });
    }

    // 8. Se não reabrindo E lote está em quarentena — liberar quarentena
    if (!dto.reabrir && lote?.status === 'quarentena') {
      const decisao = dto.situacao === SituacaoRevisao.APROVADO
        ? DecisaoQuarentena.Aprovado
        : DecisaoQuarentena.Reprovado;

      const observacaoLiberacao = dto.situacao === SituacaoRevisao.APROVADO
        ? (dto.observacao || 'Aprovado pela revisão de laudo')
        : dto.observacao!;

      await this.recebimentoService.liberarQuarentena(
        tenantId,
        userId,
        ensaio.fvm_lote_id,
        { decisao, observacao: observacaoLiberacao },
      ).catch((err: unknown) => {
        if (err instanceof UnprocessableEntityException) {
          this.logger.warn(
            `liberarQuarentena ignorada para lote ${ensaio.fvm_lote_id} — lote não está em quarentena (revisao=${id})`,
          );
        } else {
          throw err;
        }
      });
    }

    // 9. WhatsApp notification (SPEC 4) — fire-and-forget, não bloqueia a resposta
    if (!dto.reabrir && (dto.situacao === SituacaoRevisao.APROVADO || dto.situacao === SituacaoRevisao.REPROVADO)) {
      this.alertasService.notificarRevisao({
        tenantId,
        obraId: ensaio.obra_id,
        revisaoId: id,
        situacao: dto.situacao as 'APROVADO' | 'REPROVADO',
        tiposEnsaio: 'Ensaio laboratorial', // simplificado — SPEC 5 pode melhorar
        loteCodigo: String(ensaio.fvm_lote_id),
      }).catch((e: unknown) => this.logger.error(`Notificação WhatsApp falhou: ${e}`));
    }

    // 10. Audit log
    const acao = dto.reabrir ? 'REVISAO_REABERTA' : `LAUDO_${dto.situacao}`;
    this.auditLog(tenantId, userId, acao, 'ensaio_revisao', id, {
      ensaio_id: revisao.ensaio_id,
      situacao_anterior: situacaoAnterior,
      situacao_nova: dto.situacao,
      fvm_lote_id: ensaio.fvm_lote_id,
    });

    return { id, situacao: dto.situacao, revisado_em: new Date() };
  }
}
