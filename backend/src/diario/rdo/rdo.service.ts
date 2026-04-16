// backend/src/diario/rdo/rdo.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateRdoDto } from './dto/create-rdo.dto';
import type { UpdateRdoDto } from './dto/update-rdo.dto';
import type { UpdateClimaDto } from './dto/update-clima.dto';
import type { UpdateMaoObraDto } from './dto/update-mao-obra.dto';
import type { UpdateEquipamentosDto } from './dto/update-equipamentos.dto';
import type { UpdateAtividadesDto } from './dto/update-atividades.dto';
import type { UpdateOcorrenciasDto } from './dto/update-ocorrencias.dto';
import type { UpdateChecklistDto } from './dto/update-checklist.dto';
import type { StatusRdoDto } from './dto/status-rdo.dto';
import type {
  Rdo,
  RdoCompleto,
  RdoListResponse,
  RdoCreateResponse,
  RdoStatusResponse,
  RdoStatus,
  JobAcionarAgentesIa,
  JobGerarResumoIa,
  JobGerarPdf,
} from './types/rdo.types';

// Transições de status válidas
const TRANSICOES_VALIDAS: Record<RdoStatus, RdoStatus[]> = {
  preenchendo: ['revisao'],
  revisao: ['aprovado'],
  aprovado: [],
  cancelado: [],
};

// Roles com permissão de aprovação
const ROLES_APROVADOR = ['ADMIN_TENANT', 'ENGENHEIRO', 'APROVADOR'];

export interface ListRdosQuery {
  obra_id: number;
  status?: string;
  data_inicio?: string;
  data_fim?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class RdoService {
  private readonly logger = new Logger(RdoService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('diario') private readonly diarioQueue: Queue,
  ) {}

  // ─── Helper: buscar RDO com validação de tenant ───────────────────────────

  private async getRdoOuFalhar(tenantId: number, rdoId: number): Promise<Rdo> {
    const rows = await this.prisma.$queryRawUnsafe<Rdo[]>(
      `SELECT * FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      rdoId,
      tenantId,
    );
    if (!rows.length) {
      throw new NotFoundException({ error: `RDO ${rdoId} não encontrado`, code: 'RDO_404' });
    }
    return rows[0];
  }

  // ─── Helper: gravar log de edição ─────────────────────────────────────────
  // FIX #2: parâmetro renomeado de `acao` para `via`; colunas corrigidas
  // (removido `acao` e `criado_em` — tabela imutável, `created_at` é default)

  private async gravarLogEdicao(
    tx: any,
    params: {
      rdoId: number;
      tenantId: number;
      usuarioId: number;
      campo: string;
      valorAnterior?: any;
      valorNovo?: any;
      via: string;
    },
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO rdo_log_edicoes
         (rdo_id, tenant_id, usuario_id, campo, valor_anterior, valor_novo, via)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      params.rdoId,
      params.tenantId,
      params.usuarioId,
      params.campo,
      params.valorAnterior !== undefined ? JSON.stringify(params.valorAnterior) : null,
      params.valorNovo !== undefined ? JSON.stringify(params.valorNovo) : null,
      params.via,
    );
  }

  // ─── Helper: verificar se obra pertence ao tenant ─────────────────────────
  // FIX #1: tabela "Obra" (PascalCase), colunas "tenantId" e "deletadoEm"

  private async getObraOuFalhar(tenantId: number, obraId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, nome FROM "Obra" WHERE id = $1 AND "tenantId" = $2 AND "deletadoEm" IS NULL`,
      obraId,
      tenantId,
    );
    if (!rows.length) {
      throw new NotFoundException({ error: `Obra ${obraId} não encontrada`, code: 'RDO_OBRA_404' });
    }
    return rows[0];
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(
    tenantId: number,
    usuarioId: number,
    dto: CreateRdoDto,
  ): Promise<RdoCreateResponse> {
    const start = Date.now();

    // 1. Verificar se obra existe e pertence ao tenant
    await this.getObraOuFalhar(tenantId, dto.obra_id);

    // 2. Verificar se já existe RDO para a data (409 se sim)
    const existente = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM rdos WHERE obra_id = $1 AND tenant_id = $2 AND data = $3 AND deleted_at IS NULL`,
      dto.obra_id,
      tenantId,
      dto.data,
    );
    if (existente.length) {
      throw new ConflictException({
        error: 'Já existe um RDO para esta obra e data',
        field: 'data',
        code: 'RDO_001',
      });
    }

    // 3. Criar o RDO em transação
    // FIX #3: coluna `numero` com subquery sequencial; removido `criado_em`/`atualizado_em`
    const rdo = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Rdo[]>(
        `INSERT INTO rdos (tenant_id, obra_id, data, numero, status, criado_por)
         VALUES ($1, $2, $3,
           (SELECT COALESCE(MAX(numero), 0) + 1 FROM rdos WHERE obra_id = $2 AND tenant_id = $1 AND deleted_at IS NULL),
           'preenchendo'::rdo_status, $4)
         RETURNING *`,
        tenantId,
        dto.obra_id,
        dto.data,
        usuarioId,
      );
      const novoRdo = rows[0];

      // 4. Se dto.copiar_ultimo: copiar campos do último RDO
      if (dto.copiar_ultimo) {
        await this.copiarUltimoRdo(tx, tenantId, novoRdo.id, dto.obra_id, dto.copiar_campos);
      }

      // 5. Gravar log: RDO criado — FIX #2: `via` em vez de `acao`
      await this.gravarLogEdicao(tx, {
        rdoId: novoRdo.id,
        tenantId,
        usuarioId,
        campo: 'status',
        valorNovo: 'preenchendo',
        via: 'web',
      });

      return novoRdo;
    });

    // 6. Despachar job acionar-agentes-ia (assíncrono — não bloqueia)
    const jobPayloadCriar: JobAcionarAgentesIa = { rdoId: rdo.id, tenantId, usuarioId };
    await this.diarioQueue.add('acionar-agentes-ia', jobPayloadCriar, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    const ms = Date.now() - start;
    this.logger.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date(),
        tenant_id: tenantId,
        user_id: usuarioId,
        action: 'rdo.create',
        rdo_id: rdo.id,
        ms,
      }),
    );

    // 7. Retornar o RDO criado (sugestoes_ia virão via BullMQ/SSE separado)
    return {
      rdo_id: rdo.id,
      status: 'preenchendo',
      sugestoes_ia: null,
    };
  }

  private async copiarUltimoRdo(
    tx: any,
    tenantId: number,
    novoRdoId: number,
    obraId: number,
    campos?: string[],
  ): Promise<void> {
    const camposAlvo = campos ?? ['clima', 'equipe', 'atividades'];

    // Buscar o RDO anterior mais recente desta obra (excluindo o que acabou de ser criado)
    const ultimoRows = (await tx.$queryRawUnsafe(
      `SELECT id FROM rdos
       WHERE obra_id = $1 AND tenant_id = $2
         AND id != $3 AND deleted_at IS NULL
       ORDER BY data DESC LIMIT 1`,
      obraId, tenantId, novoRdoId,
    )) as { id: number }[];

    if (!ultimoRows.length) {
      this.logger.log(JSON.stringify({
        level: 'info', action: 'rdo.copiar_ultimo.skip',
        rdo_id: novoRdoId, motivo: 'sem_rdo_anterior',
      }));
      return;
    }

    const origemId = ultimoRows[0].id;

    // Atualizar copiado_de_id no novo RDO para rastreabilidade
    await tx.$executeRawUnsafe(
      `UPDATE rdos SET copiado_de_id = $1 WHERE id = $2 AND tenant_id = $3`,
      origemId, novoRdoId, tenantId,
    );

    // ── clima ────────────────────────────────────────────────────────────────
    if (camposAlvo.includes('clima')) {
      const climaRows = (await tx.$queryRawUnsafe(
        `SELECT periodo, condicao, praticavel, chuva_mm FROM rdo_clima
         WHERE rdo_id = $1 AND tenant_id = $2`,
        origemId, tenantId,
      )) as any[];
      for (const c of climaRows) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_clima (rdo_id, tenant_id, periodo, condicao, praticavel, chuva_mm, aplicado_pelo_usuario)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE)
           ON CONFLICT (tenant_id, rdo_id, periodo) DO NOTHING`,
          novoRdoId, tenantId, c.periodo, c.condicao, c.praticavel, c.chuva_mm ?? null,
        );
      }
    }

    // ── equipe (mão de obra) ──────────────────────────────────────────────────
    if (camposAlvo.includes('equipe')) {
      const maoRows = (await tx.$queryRawUnsafe(
        `SELECT tipo, funcao, quantidade, nome_personalizado, hora_entrada, hora_saida
         FROM rdo_mao_de_obra WHERE rdo_id = $1 AND tenant_id = $2`,
        origemId, tenantId,
      )) as any[];
      for (const m of maoRows) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_mao_de_obra
             (rdo_id, tenant_id, tipo, funcao, quantidade, nome_personalizado, hora_entrada, hora_saida)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          novoRdoId, tenantId, m.tipo, m.funcao, m.quantidade,
          m.nome_personalizado ?? null, m.hora_entrada ?? null, m.hora_saida ?? null,
        );
      }
    }

    // ── atividades ────────────────────────────────────────────────────────────
    if (camposAlvo.includes('atividades')) {
      const atividadeRows = (await tx.$queryRawUnsafe(
        `SELECT descricao, etapa_tarefa_id, progresso_pct, ordem
         FROM rdo_atividades WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY ordem`,
        origemId, tenantId,
      )) as any[];
      for (const a of atividadeRows) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_atividades
             (rdo_id, tenant_id, descricao, etapa_tarefa_id,
              progresso_pct_anterior, progresso_pct, ordem)
           VALUES ($1, $2, $3, $4, $5, 0, $6)`,
          novoRdoId, tenantId, a.descricao, a.etapa_tarefa_id ?? null,
          a.progresso_pct, a.ordem,
        );
      }
    }

    // ── equipamentos ──────────────────────────────────────────────────────────
    if (camposAlvo.includes('equipamentos')) {
      const equipRows = (await tx.$queryRawUnsafe(
        `SELECT nome, quantidade, do_catalogo_id FROM rdo_equipamentos
         WHERE rdo_id = $1 AND tenant_id = $2`,
        origemId, tenantId,
      )) as any[];
      for (const e of equipRows) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_equipamentos (rdo_id, tenant_id, nome, quantidade, do_catalogo_id)
           VALUES ($1, $2, $3, $4, $5)`,
          novoRdoId, tenantId, e.nome, e.quantidade, e.do_catalogo_id ?? null,
        );
      }
    }

    // ── checklist ─────────────────────────────────────────────────────────────
    if (camposAlvo.includes('checklist')) {
      const checkRows = (await tx.$queryRawUnsafe(
        `SELECT descricao, template_item_id, ordem FROM rdo_checklist_itens
         WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY ordem`,
        origemId, tenantId,
      )) as any[];
      for (const ch of checkRows) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_checklist_itens
             (rdo_id, tenant_id, descricao, marcado, template_item_id, ordem)
           VALUES ($1, $2, $3, FALSE, $4, $5)`,
          novoRdoId, tenantId, ch.descricao, ch.template_item_id ?? null, ch.ordem,
        );
      }
    }

    this.logger.log(JSON.stringify({
      level: 'info', action: 'rdo.copiar_ultimo',
      rdo_id: novoRdoId, copiado_de: origemId, campos: camposAlvo,
    }));
  }

  // FIX #4: `list` — COUNT real para `total`, `status_counts` via GROUP BY,
  // JOIN corrigido para "Obra" com colunas PascalCase

  async list(tenantId: number, query: ListRdosQuery): Promise<RdoListResponse> {
    const { obra_id, status, data_inicio, data_fim, page = 1, limit = 20 } = query;

    if (!obra_id) {
      throw new BadRequestException({ error: 'obra_id é obrigatório', field: 'obra_id', code: 'RDO_002' });
    }

    const offset = (page - 1) * limit;

    const [rdos, totalRows, statusCountRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Rdo[]>(
        `SELECT r.*, o.nome AS obra_nome
         FROM rdos r
         LEFT JOIN "Obra" o ON o.id = r.obra_id
         WHERE r.obra_id = $1
           AND r.tenant_id = $2
           AND r.deleted_at IS NULL
           AND ($3::text IS NULL OR r.status = $3::rdo_status)
           AND ($4::date IS NULL OR r.data >= $4::date)
           AND ($5::date IS NULL OR r.data <= $5::date)
         ORDER BY r.data DESC
         LIMIT $6 OFFSET $7`,
        obra_id,
        tenantId,
        status ?? null,
        data_inicio ?? null,
        data_fim ?? null,
        limit,
        offset,
      ),
      this.prisma.$queryRawUnsafe<{ total: number }[]>(
        `SELECT COUNT(*)::int AS total
         FROM rdos
         WHERE obra_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
           AND ($3::text IS NULL OR status = $3::rdo_status)
           AND ($4::date IS NULL OR data >= $4::date)
           AND ($5::date IS NULL OR data <= $5::date)`,
        obra_id,
        tenantId,
        status ?? null,
        data_inicio ?? null,
        data_fim ?? null,
      ),
      this.prisma.$queryRawUnsafe<{ status: string; contagem: number }[]>(
        `SELECT status, COUNT(*)::int AS contagem
         FROM rdos
         WHERE obra_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         GROUP BY status`,
        obra_id,
        tenantId,
      ),
    ]);

    const total: number = totalRows[0]?.total ?? 0;

    const status_counts: Record<string, number> = {
      preenchendo: 0,
      revisao: 0,
      aprovado: 0,
      cancelado: 0,
    };
    for (const row of statusCountRows) {
      status_counts[row.status] = row.contagem;
    }

    return {
      data: rdos as any[],
      total,
      page,
      limit,
      status_counts,
    };
  }

  // FIX #5: `findById` — tabela `rdo_mao_de_obra`, `rdo_checklist_itens`,
  // e log ordenado por `created_at` (não `criado_em`)

  async findById(tenantId: number, rdoId: number): Promise<RdoCompleto> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);

    const [clima, maoObra, equipamentos, atividades, ocorrencias, checklist, fotos, assinaturas, logEdicoes] =
      await Promise.all([
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_clima WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY periodo`,
          rdoId, tenantId,
        ),
        // FIX #8: tabela `rdo_mao_de_obra` (não `rdo_mao_obra`)
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_mao_de_obra WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY funcao`,
          rdoId, tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_equipamentos WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId, tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_atividades WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId, tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_ocorrencias WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId, tenantId,
        ),
        // FIX #12: tabela `rdo_checklist_itens` (não `rdo_checklist`)
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_checklist_itens WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId, tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_fotos WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId, tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_assinaturas WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId, tenantId,
        ),
        // FIX #5: ORDER BY `created_at` (não `criado_em`)
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_log_edicoes WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 100`,
          rdoId, tenantId,
        ),
      ]);

    return {
      ...rdo,
      clima,
      mao_obra: maoObra,
      equipamentos,
      atividades,
      ocorrencias,
      checklist,
      fotos,
      assinaturas,
      log_edicoes: logEdicoes,
    };
  }

  async update(
    tenantId: number,
    usuarioId: number,
    rdoId: number,
    dto: UpdateRdoDto,
  ): Promise<Rdo> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);

    if (rdo.status === 'aprovado') {
      throw new BadRequestException({
        error: 'Não é possível editar um RDO aprovado',
        code: 'RDO_003',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const campos = Object.entries(dto).filter(([, v]) => v !== undefined);

      // FIX #2: `via: 'web'` em vez de `acao`
      for (const [campo, valor] of campos) {
        await this.gravarLogEdicao(tx, {
          rdoId,
          tenantId,
          usuarioId,
          campo,
          valorAnterior: (rdo as any)[campo],
          valorNovo: valor,
          via: 'web',
        });
      }

      if (campos.length > 0) {
        const setClauses = campos.map(([k], i) => `"${k}" = $${i + 3}`).join(', ');
        await tx.$executeRawUnsafe(
          `UPDATE rdos SET ${setClauses}, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          rdoId, tenantId, ...campos.map(([, v]) => v),
        );
      } else {
        await tx.$executeRawUnsafe(
          `UPDATE rdos SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          rdoId, tenantId,
        );
      }

      const rows = await tx.$queryRawUnsafe<Rdo[]>(
        `SELECT * FROM rdos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        rdoId, tenantId,
      );

      this.logger.log(
        JSON.stringify({
          level: 'info',
          timestamp: new Date(),
          tenant_id: tenantId,
          user_id: usuarioId,
          action: 'rdo.update',
          rdo_id: rdoId,
        }),
      );

      return rows[0];
    });
  }

  async remove(
    tenantId: number,
    usuarioId: number,
    userRole: string,
    rdoId: number,
  ): Promise<void> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);

    if (rdo.status !== 'preenchendo') {
      throw new BadRequestException({
        error: 'Só é possível excluir RDOs com status preenchendo',
        code: 'RDO_004',
      });
    }

    const podeExcluir =
      rdo.criado_por === usuarioId || ROLES_APROVADOR.includes(userRole);

    if (!podeExcluir) {
      throw new ForbiddenException({
        error: 'Sem permissão para excluir este RDO',
        code: 'RDO_005',
      });
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE rdos SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      rdoId,
      tenantId,
    );

    this.logger.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date(),
        tenant_id: tenantId,
        user_id: usuarioId,
        action: 'rdo.delete',
        rdo_id: rdoId,
      }),
    );
  }

  // ─── Workflow de Status ───────────────────────────────────────────────────

  async updateStatus(
    tenantId: number,
    usuarioId: number,
    userRole: string,
    rdoId: number,
    dto: StatusRdoDto,
  ): Promise<RdoStatusResponse> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);
    const start = Date.now();

    // Validar transição
    const transicoesPermitidas = TRANSICOES_VALIDAS[rdo.status] ?? [];
    if (!transicoesPermitidas.includes(dto.status)) {
      throw new BadRequestException({
        error: `Transição inválida: ${rdo.status} → ${dto.status}`,
        field: 'status',
        code: 'RDO_006',
      });
    }

    // Para aprovação: verificar permissão (role ENGENHEIRO ou Aprovador)
    if (dto.status === 'aprovado' && !ROLES_APROVADOR.includes(userRole)) {
      throw new ForbiddenException({
        error: 'Apenas ENGENHEIRO ou Aprovador podem aprovar RDOs',
        code: 'RDO_007',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Atualizar status — `updated_at` é coluna real da tabela `rdos`
      await tx.$executeRawUnsafe(
        `UPDATE rdos SET status = $1::rdo_status, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
        dto.status,
        rdoId,
        tenantId,
      );

      // FIX #6: colunas corretas em rdo_assinaturas: `papel` e `assinado_em`
      if (dto.status === 'aprovado' && dto.assinatura_base64) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_assinaturas (rdo_id, tenant_id, usuario_id, assinatura_base64, papel, assinado_em)
           VALUES ($1, $2, $3, $4, 'gestor', NOW())`,
          rdoId,
          tenantId,
          usuarioId,
          dto.assinatura_base64,
        );

        // Atualizar aprovado_por e aprovado_em
        await tx.$executeRawUnsafe(
          `UPDATE rdos SET aprovado_por = $1, aprovado_em = NOW() WHERE id = $2 AND tenant_id = $3`,
          usuarioId,
          rdoId,
          tenantId,
        );
      }

      // FIX #2: `via: 'web'` em vez de `acao`
      await this.gravarLogEdicao(tx, {
        rdoId,
        tenantId,
        usuarioId,
        campo: 'status',
        valorAnterior: rdo.status,
        valorNovo: dto.status,
        via: 'web',
      });
    });

    // Jobs assíncronos após aprovação
    if (dto.status === 'aprovado') {
      const jobResumo: JobGerarResumoIa = { rdoId, tenantId };
      const jobPdf: JobGerarPdf = { rdoId, tenantId };
      await Promise.all([
        this.diarioQueue.add('gerar-resumo-ia', jobResumo, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
        }),
        this.diarioQueue.add('gerar-pdf', jobPdf, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      ]);
    }

    const ms = Date.now() - start;
    this.logger.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date(),
        tenant_id: tenantId,
        user_id: usuarioId,
        action: 'rdo.status',
        rdo_id: rdoId,
        status_de: rdo.status,
        status_para: dto.status,
        ms,
      }),
    );

    return {
      rdo_id: rdoId,
      status: dto.status,
      // resumo_ia e pdf_url serão preenchidos quando os jobs completarem
    };
  }

  // ─── Seções ───────────────────────────────────────────────────────────────

  // FIX #7: upsertClima — sem `criado_em`/`atualizado_em`; UNIQUE em (tenant_id, rdo_id, periodo)

  async upsertClima(
    tenantId: number,
    usuarioId: number,
    rdoId: number,
    dto: UpdateClimaDto,
  ): Promise<any[]> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);
    this.assertEditavel(rdo);

    return this.prisma.$transaction(async (tx) => {
      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_clima (rdo_id, tenant_id, periodo, condicao, praticavel, chuva_mm, aplicado_pelo_usuario)
           VALUES ($1, $2, $3::rdo_periodo, $4::rdo_condicao_clima, $5, $6, $7)
           ON CONFLICT (tenant_id, rdo_id, periodo) DO UPDATE
           SET condicao = EXCLUDED.condicao,
               praticavel = EXCLUDED.praticavel,
               chuva_mm = EXCLUDED.chuva_mm,
               aplicado_pelo_usuario = EXCLUDED.aplicado_pelo_usuario`,
          rdoId, tenantId, item.periodo, item.condicao, item.praticavel,
          item.chuva_mm ?? null, item.aplicado_pelo_usuario,
        );

        // FIX #2: `via: 'web'`
        await this.gravarLogEdicao(tx, {
          rdoId, tenantId, usuarioId,
          campo: `clima.${item.periodo}`,
          valorNovo: item,
          via: 'web',
        });
      }

      return tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM rdo_clima WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY periodo`,
        rdoId, tenantId,
      );
    });
  }

  // FIX #8: tabela `rdo_mao_de_obra` em todos os lugares; removido `criado_em`

  async substituirMaoObra(
    tenantId: number,
    usuarioId: number,
    rdoId: number,
    dto: UpdateMaoObraDto,
  ): Promise<any[]> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);
    this.assertEditavel(rdo);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM rdo_mao_de_obra WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_mao_de_obra (rdo_id, tenant_id, funcao, quantidade, tipo, nome_personalizado, hora_entrada, hora_saida)
           VALUES ($1, $2, $3, $4, $5::rdo_tipo_mao_de_obra, $6, $7, $8)`,
          rdoId, tenantId, item.funcao, item.quantidade, item.tipo,
          item.nome_personalizado ?? null, item.hora_entrada ?? null, item.hora_saida ?? null,
        );
      }

      // FIX #2: `via: 'web'`
      await this.gravarLogEdicao(tx, {
        rdoId, tenantId, usuarioId,
        campo: 'mao_obra',
        valorNovo: { total_itens: dto.itens.length },
        via: 'web',
      });

      return tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM rdo_mao_de_obra WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY funcao`,
        rdoId, tenantId,
      );
    });
  }

  // FIX #9: colunas corretas — `nome` (era `descricao`), sem `unidade`/`observacao`/`criado_em`

  async substituirEquipamentos(
    tenantId: number,
    usuarioId: number,
    rdoId: number,
    dto: UpdateEquipamentosDto,
  ): Promise<any[]> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);
    this.assertEditavel(rdo);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM rdo_equipamentos WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_equipamentos (rdo_id, tenant_id, nome, quantidade, do_catalogo_id)
           VALUES ($1, $2, $3, $4, $5)`,
          rdoId, tenantId,
          item.nome,
          item.quantidade,
          item.do_catalogo_id ?? null,
        );
      }

      // FIX #2: `via: 'web'`
      await this.gravarLogEdicao(tx, {
        rdoId, tenantId, usuarioId,
        campo: 'equipamentos',
        valorNovo: { total_itens: dto.itens.length },
        via: 'web',
      });

      return tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM rdo_equipamentos WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );
    });
  }

  // FIX #10: colunas corretas — sem `pavimento`, `servico`, `percentual_executado`, `observacao`, `criado_em`

  async substituirAtividades(
    tenantId: number,
    usuarioId: number,
    rdoId: number,
    dto: UpdateAtividadesDto,
  ): Promise<any[]> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);
    this.assertEditavel(rdo);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM rdo_atividades WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_atividades
             (rdo_id, tenant_id, descricao, etapa_tarefa_id, hora_inicio, hora_fim, progresso_pct, ordem)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          rdoId, tenantId,
          item.descricao,
          (item as any).etapa_tarefa_id ?? null,
          (item as any).hora_inicio ?? null,
          (item as any).hora_fim ?? null,
          (item as any).progresso_pct ?? 0,
          (item as any).ordem ?? 0,
        );
      }

      // FIX #2: `via: 'web'`
      await this.gravarLogEdicao(tx, {
        rdoId, tenantId, usuarioId,
        campo: 'atividades',
        valorNovo: { total_itens: dto.itens.length },
        via: 'web',
      });

      return tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM rdo_atividades WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );
    });
  }

  // FIX #11: colunas corretas — sem `tipo`, `grau_impacto`, `acao_tomada`, `criado_em`

  async substituirOcorrencias(
    tenantId: number,
    usuarioId: number,
    rdoId: number,
    dto: UpdateOcorrenciasDto,
  ): Promise<any[]> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);
    this.assertEditavel(rdo);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM rdo_ocorrencias WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_ocorrencias (rdo_id, tenant_id, descricao, tags, tipo_ocorrencia_id)
           VALUES ($1, $2, $3, $4::text[], $5)`,
          rdoId, tenantId,
          item.descricao,
          (item as any).tags ?? null,
          (item as any).tipo_ocorrencia_id ?? null,
        );
      }

      // FIX #2: `via: 'web'`
      await this.gravarLogEdicao(tx, {
        rdoId, tenantId, usuarioId,
        campo: 'ocorrencias',
        valorNovo: { total_itens: dto.itens.length },
        via: 'web',
      });

      return tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM rdo_ocorrencias WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );
    });
  }

  // FIX #12: tabela `rdo_checklist_itens`; colunas `descricao`, `marcado`, `ordem`

  async substituirChecklist(
    tenantId: number,
    usuarioId: number,
    rdoId: number,
    dto: UpdateChecklistDto,
  ): Promise<any[]> {
    const rdo = await this.getRdoOuFalhar(tenantId, rdoId);
    this.assertEditavel(rdo);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM rdo_checklist_itens WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO rdo_checklist_itens (rdo_id, tenant_id, descricao, marcado, ordem)
           VALUES ($1, $2, $3, $4, $5)`,
          rdoId, tenantId,
          (item as any).descricao,     // era item.item
          (item as any).marcado ?? false, // era item.resposta
          (item as any).ordem ?? 0,
        );
      }

      // FIX #2: `via: 'web'`
      await this.gravarLogEdicao(tx, {
        rdoId, tenantId, usuarioId,
        campo: 'checklist',
        valorNovo: { total_itens: dto.itens.length },
        via: 'web',
      });

      return tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM rdo_checklist_itens WHERE rdo_id = $1 AND tenant_id = $2`,
        rdoId, tenantId,
      );
    });
  }

  // ─── Inteligência da Obra ─────────────────────────────────────────────────

  async getInteligenciaObra(tenantId: number, obraId: number): Promise<any> {
    await this.getObraOuFalhar(tenantId, obraId);

    const [diasSemRelatorio, tendenciaRows, topOcorrencias] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ dias: number }[]>(
        `SELECT COALESCE(EXTRACT(DAY FROM NOW() - MAX(data))::int, 0) AS dias
         FROM rdos
         WHERE obra_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        obraId, tenantId,
      ),
      this.prisma.$queryRawUnsafe<{ media_7d: number | null; media_30d: number | null }[]>(
        `SELECT
           AVG(CASE WHEN r.data >= CURRENT_DATE - INTERVAL '7 days' THEN a.progresso_pct END) AS media_7d,
           AVG(CASE WHEN r.data >= CURRENT_DATE - INTERVAL '30 days' THEN a.progresso_pct END) AS media_30d
         FROM rdo_atividades a
         JOIN rdos r ON r.id = a.rdo_id
         WHERE r.obra_id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL`,
        obraId, tenantId,
      ),
      this.prisma.$queryRawUnsafe<{ tag: string; total: number }[]>(
        `SELECT tags[1] AS tag, COUNT(*)::int AS total
         FROM rdo_ocorrencias ro
         JOIN rdos r ON r.id = ro.rdo_id
         WHERE r.obra_id = $1 AND ro.tenant_id = $2
           AND r.deleted_at IS NULL
           AND tags IS NOT NULL AND array_length(tags, 1) > 0
         GROUP BY tags[1]
         ORDER BY total DESC
         LIMIT 5`,
        obraId, tenantId,
      ),
    ]);

    // Risco de atraso baseado em dias sem relatório
    const dias: number = diasSemRelatorio[0]?.dias ?? 0;
    const risco_atraso_pct = Math.min(100, Math.round((dias / 4) * 100));

    // Tendência baseada em média de progresso 7d vs 30d
    const media7d = tendenciaRows[0]?.media_7d ?? null;
    const media30d = tendenciaRows[0]?.media_30d ?? null;
    let tendencia: 'acelerando' | 'estavel' | 'desacelerando' = 'estavel';
    if (media7d !== null && media30d !== null) {
      if (media7d > media30d + 5) {
        tendencia = 'acelerando';
      } else if (media7d < media30d - 5) {
        tendencia = 'desacelerando';
      }
    }

    return {
      risco_atraso_pct,
      tendencia,
      dias_sem_relatorio: dias,
      top_ocorrencias: topOcorrencias,
      previsao_conclusao_ia: null,
    };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private assertEditavel(rdo: Rdo): void {
    if (rdo.status === 'aprovado') {
      throw new BadRequestException({
        error: 'Não é possível editar seções de um RDO aprovado',
        code: 'RDO_003',
      });
    }
  }
}
