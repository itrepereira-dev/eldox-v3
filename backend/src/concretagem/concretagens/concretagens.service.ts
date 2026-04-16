// backend/src/concretagem/concretagens/concretagens.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateConcrtagemDto } from './dto/create-concretagem.dto';
import type { UpdateConcrtagemDto } from './dto/update-concretagem.dto';
import type { ListConcrtagensDto } from './dto/list-concretagens.dto';
import { EmailConcrtagemService } from './email-concretagem.service';

@Injectable()
export class ConcrtagensService {
  private readonly logger = new Logger(ConcrtagensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSvc: EmailConcrtagemService,
  ) {}

  // ── Gerar número sequencial ──────────────────────────────────────────────

  async gerarNumero(tenantId: number, obraId: number): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM concretagens WHERE tenant_id = $1 AND obra_id = $2`,
      tenantId,
      obraId,
    );
    const seq = (Number(rows[0]?.total ?? 0) + 1).toString().padStart(4, '0');
    return `CONC-${obraId}-${seq}`;
  }

  // ── Criar concretagem ────────────────────────────────────────────────────

  async criar(
    tenantId: number,
    obraId: number,
    userId: number,
    dto: CreateConcrtagemDto,
  ) {
    await this.validarObra(tenantId, obraId);
    const numero = await this.gerarNumero(tenantId, obraId);

    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO concretagens
         (tenant_id, obra_id, numero, elemento_estrutural, obra_local_id,
          volume_previsto, traco_especificado, fck_especificado, fornecedor_id,
          data_programada, hora_programada, responsavel_id, observacoes, criado_por,
          bombeado, liberado_carregamento, intervalo_min_caminhoes, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
       RETURNING id`,
      tenantId,
      obraId,
      numero,
      dto.elemento_estrutural,
      dto.obra_local_id ?? null,
      dto.volume_previsto,
      dto.traco_especificado ?? null,
      dto.fck_especificado,
      dto.fornecedor_id,
      dto.data_programada,
      dto.hora_programada ?? null,
      dto.responsavel_id ?? null,
      dto.observacoes ?? null,
      userId,
      dto.bombeado ?? false,
      dto.liberado_carregamento ?? false,
      dto.intervalo_min_caminhoes ?? null,
    );

    this.auditLog(tenantId, userId, 'CREATE', rows[0].id, null, dto).catch(
      (e: unknown) => this.logger.error(`auditLog concretagem falhou: ${e}`),
    );

    this.emailSvc.enviarNotificacaoUsina(tenantId, rows[0].id, 'NOVA_BETONADA').catch(
      (e: unknown) => this.logger.error(`emailSvc NOVA_BETONADA falhou: ${e}`),
    );

    return this.buscar(tenantId, rows[0].id);
  }

  // ── Listar concretagens ──────────────────────────────────────────────────

  async listar(tenantId: number, obraId: number, query: ListConcrtagensDto) {
    await this.validarObra(tenantId, obraId);

    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const params: unknown[] = [tenantId, obraId];
    const conditions: string[] = [
      'tenant_id = $1',
      'obra_id = $2',
      'deleted_at IS NULL',
    ];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}::\"StatusConcretagem\"`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(`(numero ILIKE $${params.length} OR elemento_estrutural ILIKE $${params.length})`);
    }

    const where = conditions.join(' AND ');

    const countRows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM concretagens WHERE ${where}`,
      ...params,
    );

    params.push(limit, offset);
    const items = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, numero, elemento_estrutural, obra_local_id, volume_previsto, fck_especificado,
              fornecedor_id, data_programada, status, responsavel_id, observacoes, created_at, updated_at
       FROM concretagens
       WHERE ${where}
       ORDER BY data_programada DESC, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    );

    return {
      items,
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
    };
  }

  // ── Buscar concretagem (com caminhões e CPs) ─────────────────────────────

  async buscar(tenantId: number, id: number) {
    const rows = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, tenant_id, obra_id, numero, elemento_estrutural, obra_local_id,
              volume_previsto, traco_especificado, fck_especificado, fornecedor_id,
              data_programada, hora_programada, status, responsavel_id, observacoes,
              criado_por, bombeado, liberado_carregamento, intervalo_min_caminhoes,
              created_at, updated_at
       FROM concretagens
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      tenantId,
      id,
    );

    if (!rows[0]) throw new NotFoundException('Concretagem não encontrada');

    const caminhoes = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, sequencia, numero_nf, data_emissao_nf, volume, motorista, placa,
              hora_chegada, hora_inicio_lancamento, hora_fim_lancamento, elemento_lancado,
              slump_especificado, slump_medido, temperatura, status, nf_vencida,
              lacre_aprovado, nao_descarregou, fator_ac, flow, ensaio_j,
              sobra_tipo, sobra_volume, foto_nf_url, created_at
       FROM caminhoes_concreto
       WHERE tenant_id = $1 AND concretagem_id = $2
       ORDER BY sequencia ASC`,
      tenantId,
      id,
    );

    const cps = await this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, caminhao_id, numero, idade_dias, data_moldagem, data_ruptura_prev,
              data_ruptura_real, resistencia, status, alerta_enviado, created_at
       FROM corpos_de_prova
       WHERE tenant_id = $1 AND concretagem_id = $2
       ORDER BY data_moldagem ASC, numero ASC`,
      tenantId,
      id,
    );

    return { ...(rows[0] as object), caminhoes, corpos_de_prova: cps };
  }

  // ── Atualizar concretagem ────────────────────────────────────────────────

  async atualizar(
    tenantId: number,
    id: number,
    userId: number,
    dto: UpdateConcrtagemDto,
  ) {
    const antes = await this.buscar(tenantId, id);

    const sets: string[] = [];
    const params: unknown[] = [tenantId, id];
    let idx = 3;

    const fieldMap: Record<string, string> = {
      elemento_estrutural: 'elemento_estrutural',
      obra_local_id: 'obra_local_id',
      volume_previsto: 'volume_previsto',
      traco_especificado: 'traco_especificado',
      fck_especificado: 'fck_especificado',
      fornecedor_id: 'fornecedor_id',
      data_programada: 'data_programada',
      hora_programada: 'hora_programada',
      responsavel_id: 'responsavel_id',
      observacoes: 'observacoes',
      bombeado: 'bombeado',
      liberado_carregamento: 'liberado_carregamento',
      intervalo_min_caminhoes: 'intervalo_min_caminhoes',
      cancelamento_solicitante: 'cancelamento_solicitante',
      cancelamento_multa: 'cancelamento_multa',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (dto[key as keyof UpdateConcrtagemDto] !== undefined) {
        sets.push(`${col} = $${idx++}`);
        params.push(dto[key as keyof UpdateConcrtagemDto] ?? null);
      }
    }

    if (dto.status !== undefined) {
      sets.push(`status = $${idx++}::\"StatusConcretagem\"`);
      params.push(dto.status);
    }

    if (sets.length === 0) return antes;

    sets.push('updated_at = NOW()');

    await this.prisma.$executeRawUnsafe(
      `UPDATE concretagens SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      ...params,
    );

    this.auditLog(tenantId, userId, 'UPDATE', id, antes, dto).catch(
      (e: unknown) => this.logger.error(`auditLog concretagem falhou: ${e}`),
    );

    return this.buscar(tenantId, id);
  }

  // ── Cancelar concretagem (soft delete) ───────────────────────────────────

  async cancelar(tenantId: number, id: number, userId: number, motivo?: { solicitante?: string; multa?: boolean }) {
    await this.buscar(tenantId, id);

    await this.prisma.$executeRawUnsafe(
      `UPDATE concretagens
       SET status = 'CANCELADA'::"StatusConcretagem", deleted_at = NOW(), updated_at = NOW(),
           cancelamento_solicitante = $3, cancelamento_multa = $4
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      id,
      motivo?.solicitante ?? null,
      motivo?.multa ?? false,
    );

    this.auditLog(tenantId, userId, 'CANCEL', id, null, { motivo }).catch(
      (e: unknown) => this.logger.error(`auditLog concretagem falhou: ${e}`),
    );

    this.emailSvc.enviarNotificacaoUsina(tenantId, id, 'BETONADA_CANCELADA').catch(
      (e: unknown) => this.logger.error(`emailSvc BETONADA_CANCELADA falhou: ${e}`),
    );

    return { id };
  }

  // ── Toggle liberado para carregamento ────────────────────────────────────

  async toggleLiberado(tenantId: number, id: number, userId: number): Promise<{ liberado_carregamento: boolean }> {
    const rows = await this.prisma.$queryRawUnsafe<{ liberado_carregamento: boolean }[]>(
      `UPDATE concretagens
       SET liberado_carregamento = NOT liberado_carregamento, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING liberado_carregamento`,
      tenantId,
      id,
    );
    if (!rows[0]) throw new NotFoundException('Concretagem não encontrada');
    this.auditLog(tenantId, userId, 'TOGGLE_LIBERADO', id, null, { liberado_carregamento: rows[0].liberado_carregamento }).catch(
      (e: unknown) => this.logger.error(`auditLog toggleLiberado falhou: ${e}`),
    );
    return rows[0];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async validarObra(tenantId: number, obraId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "Obra" WHERE id = $1 AND "tenantId" = $2`,
      obraId,
      tenantId,
    );
    if (!rows[0]) throw new NotFoundException('Obra não encontrada');
  }

  private auditLog(
    tenantId: number,
    userId: number,
    acao: string,
    entidadeId: number,
    antes: unknown,
    depois: unknown,
  ): Promise<unknown> {
    return this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_log (tenant_id, usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
       VALUES ($1, $2, $3, 'concretagem', $4, $5::jsonb, $6::jsonb)`,
      tenantId,
      userId,
      acao,
      entidadeId,
      JSON.stringify(antes),
      JSON.stringify(depois),
    );
  }
}
