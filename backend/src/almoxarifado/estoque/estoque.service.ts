// backend/src/almoxarifado/estoque/estoque.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmEstoqueSaldo, AlmMovimento, AlmAlertaEstoque } from '../types/alm.types';
import type { CreateMovimentoDto } from './dto/create-movimento.dto';

@Injectable()
export class EstoqueService {
  private readonly logger = new Logger(EstoqueService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Saldo ─────────────────────────────────────────────────────────────────

  async getSaldo(
    tenantId: number,
    filters: { localId?: number; tipoLocal?: string; catalogoId?: number; nivel?: string } = {},
  ): Promise<AlmEstoqueSaldo[]> {
    const conditions: string[] = [`s.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.localId) {
      conditions.push(`s.local_id = $${i++}`);
      params.push(filters.localId);
    }
    if (filters.tipoLocal) {
      conditions.push(`l.tipo = $${i++}`);
      params.push(filters.tipoLocal);
    }
    if (filters.catalogoId) {
      conditions.push(`s.catalogo_id = $${i++}`);
      params.push(filters.catalogoId);
    }

    const rows = await this.prisma.$queryRawUnsafe<AlmEstoqueSaldo[]>(
      `SELECT s.*,
              m.nome      AS catalogo_nome,
              m.codigo    AS catalogo_codigo,
              l.nome      AS local_nome,
              l.tipo      AS local_tipo,
              CASE
                WHEN s.estoque_min > 0 AND s.quantidade <= s.estoque_min * 0.3 THEN 'critico'
                WHEN s.estoque_min > 0 AND s.quantidade <= s.estoque_min       THEN 'atencao'
                ELSE 'normal'
              END AS nivel
       FROM alm_estoque_saldo s
       JOIN fvm_catalogo_materiais m ON m.id = s.catalogo_id
       LEFT JOIN alm_locais l ON l.id = s.local_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.nome ASC`,
      ...params,
    );

    if (filters.nivel) {
      return rows.filter((r) => r.nivel === filters.nivel);
    }
    return rows;
  }

  // ── Movimentos ────────────────────────────────────────────────────────────

  async getMovimentos(
    tenantId: number,
    filters: { localId?: number; tipoLocal?: string; catalogoId?: number; tipo?: string; limit?: number; offset?: number } = {},
  ): Promise<AlmMovimento[]> {
    const conditions: string[] = [`mv.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.localId) {
      conditions.push(`mv.local_id = $${i++}`);
      params.push(filters.localId);
    }
    if (filters.tipoLocal) {
      conditions.push(`l.tipo = $${i++}`);
      params.push(filters.tipoLocal);
    }
    if (filters.catalogoId) {
      conditions.push(`mv.catalogo_id = $${i++}`);
      params.push(filters.catalogoId);
    }
    if (filters.tipo) {
      conditions.push(`mv.tipo = $${i++}`);
      params.push(filters.tipo);
    }

    const limit  = filters.limit  ?? 50;
    const offset = filters.offset ?? 0;
    const limitIdx  = i++;
    const offsetIdx = i++;

    return this.prisma.$queryRawUnsafe<AlmMovimento[]>(
      `SELECT mv.*,
              m.nome  AS catalogo_nome,
              l.nome  AS local_nome,
              l.tipo  AS local_tipo,
              u.nome  AS usuario_nome
       FROM alm_movimentos mv
       JOIN fvm_catalogo_materiais m ON m.id = mv.catalogo_id
       LEFT JOIN alm_locais l ON l.id = mv.local_id
       LEFT JOIN "Usuario" u ON u.id = mv.criado_por
       WHERE ${conditions.join(' AND ')}
       ORDER BY mv.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      ...params, limit, offset,
    );
  }

  // ── Registrar Movimento ───────────────────────────────────────────────────

  async registrarMovimento(
    tenantId: number,
    localId: number,
    usuarioId: number,
    dto: CreateMovimentoDto,
  ): Promise<AlmMovimento> {
    return this.prisma.$transaction(async (tx) => {
      // Lock/create saldo row (new unique constraint: tenant_id, local_id, catalogo_id)
      const saldoRows = await tx.$queryRawUnsafe<{ id: number; quantidade: number }[]>(
        `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, quantidade, unidade, updated_at)
         VALUES ($1, $2, $3, 0, $4, NOW())
         ON CONFLICT (tenant_id, local_id, catalogo_id) DO UPDATE SET id = alm_estoque_saldo.id
         RETURNING id, quantidade::float`,
        tenantId, localId, dto.catalogo_id, dto.unidade,
      );

      const saldoAnterior = Number(saldoRows[0].quantidade);
      const delta = ['saida', 'perda'].includes(dto.tipo) ? -dto.quantidade : dto.quantidade;

      if (delta < 0 && saldoAnterior + delta < 0) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${saldoAnterior} ${dto.unidade}`,
        );
      }

      const saldoPosterior = saldoAnterior + delta;

      await tx.$executeRawUnsafe(
        `UPDATE alm_estoque_saldo SET quantidade = $1, updated_at = NOW() WHERE id = $2`,
        saldoPosterior, saldoRows[0].id,
      );

      const movRows = await tx.$queryRawUnsafe<AlmMovimento[]>(
        `INSERT INTO alm_movimentos
           (tenant_id, catalogo_id, local_id, tipo, quantidade, unidade,
            saldo_anterior, saldo_posterior, referencia_tipo, referencia_id, observacao, criado_por, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         RETURNING *`,
        tenantId, dto.catalogo_id, localId, dto.tipo,
        dto.quantidade, dto.unidade, saldoAnterior, saldoPosterior,
        dto.referencia_tipo ?? null, dto.referencia_id ?? null,
        dto.observacao ?? null, usuarioId,
      );

      if (['saida', 'perda'].includes(dto.tipo)) {
        await this.avaliarAlertaEstoqueMinimo(tx as any, tenantId, localId, dto.catalogo_id, saldoPosterior);
      }

      this.logger.log(JSON.stringify({
        action: 'alm.estoque.movimento',
        tenantId, localId, tipo: dto.tipo,
        catalogoId: dto.catalogo_id, quantidade: dto.quantidade,
        saldoAnterior, saldoPosterior,
      }));

      return movRows[0];
    });
  }

  // ── Alertas ───────────────────────────────────────────────────────────────

  async getAlertas(tenantId: number, localId?: number, apenasNaoLidos = true): Promise<AlmAlertaEstoque[]> {
    const conditions: string[] = [`a.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (localId) {
      conditions.push(`a.local_id = $${i++}`);
      params.push(localId);
    }
    if (apenasNaoLidos) {
      conditions.push(`a.lido = false`);
    }

    return this.prisma.$queryRawUnsafe<AlmAlertaEstoque[]>(
      `SELECT a.*, m.nome AS catalogo_nome, l.nome AS local_nome
       FROM alm_alertas_estoque a
       JOIN fvm_catalogo_materiais m ON m.id = a.catalogo_id
       LEFT JOIN alm_locais l ON l.id = a.local_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE a.nivel WHEN 'critico' THEN 1 ELSE 2 END,
         a.criado_at DESC`,
      ...params,
    );
  }

  async marcarAlertaLido(tenantId: number, alertaId: number, usuarioId: number): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_alertas_estoque
       SET lido = true, lido_por = $1, lido_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      usuarioId, alertaId, tenantId,
    );
  }

  async marcarTodosLidos(tenantId: number, localId?: number, usuarioId?: number): Promise<void> {
    const conditions: string[] = [`tenant_id = $1`, `lido = false`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (localId) {
      conditions.push(`local_id = $${i++}`);
      params.push(localId);
    }
    if (usuarioId) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_alertas_estoque SET lido = true, lido_por = $${i}, lido_at = NOW() WHERE ${conditions.join(' AND ')}`,
        ...params, usuarioId,
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_alertas_estoque SET lido = true, lido_at = NOW() WHERE ${conditions.join(' AND ')}`,
        ...params,
      );
    }
  }

  // ── Dashboard KPIs ────────────────────────────────────────────────────────

  async getDashboardKpis(tenantId: number, localId?: number) {
    const estoqueMinConditions: string[] = [`tenant_id = $1`, `lido = false`, `nivel = 'critico'`];
    const estoqueMinParams: unknown[] = [tenantId];
    let estoqueMinI = 2;

    const solConditions: string[] = [`tenant_id = $1`, `status = 'aguardando_aprovacao'`];
    const solParams: unknown[] = [tenantId];
    let solI = 2;

    const ocConditions: string[] = [`tenant_id = $1`, `status IN ('emitida','parcialmente_recebida')`];
    const ocParams: unknown[] = [tenantId];
    let ocI = 2;

    if (localId !== undefined) {
      estoqueMinConditions.push(`local_id = $${estoqueMinI++}`);
      estoqueMinParams.push(localId);

      solConditions.push(`local_destino_id = $${solI++}`);
      solParams.push(localId);

      ocConditions.push(`local_destino_id = $${ocI++}`);
      ocParams.push(localId);
    }

    const [estoqueMin, solPendentes, nfePendente, ocAberto, conformidade] =
      await Promise.all([
        this.prisma.$queryRawUnsafe<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM alm_alertas_estoque
           WHERE ${estoqueMinConditions.join(' AND ')}`,
          ...estoqueMinParams,
        ),
        this.prisma.$queryRawUnsafe<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM alm_solicitacoes
           WHERE ${solConditions.join(' AND ')}`,
          ...solParams,
        ),
        this.prisma.$queryRawUnsafe<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM alm_notas_fiscais
           WHERE tenant_id = $1 AND status = 'pendente_match'`,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<{ total: number }[]>(
          `SELECT COALESCE(SUM(valor_total), 0)::float AS total
           FROM alm_ordens_compra
           WHERE ${ocConditions.join(' AND ')}`,
          ...ocParams,
        ),
        this.prisma.$queryRawUnsafe<{ pct: number }[]>(
          `SELECT CASE WHEN COUNT(*) = 0 THEN 100
                       ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'aceita') / COUNT(*))
                  END::int AS pct
           FROM alm_notas_fiscais
           WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
          tenantId,
        ),
      ]);

    return {
      itens_estoque_minimo:         estoqueMin[0]?.count   ?? 0,
      solicitacoes_pendentes:       solPendentes[0]?.count ?? 0,
      nfe_aguardando_match:         nfePendente[0]?.count  ?? 0,
      valor_oc_aberto:              ocAberto[0]?.total     ?? 0,
      conformidade_recebimento_pct: conformidade[0]?.pct   ?? 100,
    };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async avaliarAlertaEstoqueMinimo(
    tx: PrismaService,
    tenantId: number,
    localId: number,
    catalogoId: number,
    saldoAtual: number,
  ): Promise<void> {
    const saldoRows = await tx.$queryRawUnsafe<{ estoque_min: number }[]>(
      `SELECT estoque_min::float FROM alm_estoque_saldo
       WHERE tenant_id = $1 AND local_id = $2 AND catalogo_id = $3`,
      tenantId, localId, catalogoId,
    );

    if (!saldoRows.length || saldoRows[0].estoque_min <= 0) return;

    const estoqueMin = saldoRows[0].estoque_min;
    const nivel = saldoAtual <= estoqueMin * 0.3 ? 'critico' : saldoAtual <= estoqueMin ? 'atencao' : null;
    if (!nivel) return;

    const materialRows = await tx.$queryRawUnsafe<{ nome: string }[]>(
      `SELECT nome FROM fvm_catalogo_materiais WHERE id = $1`,
      catalogoId,
    );
    const nomeMaterial = materialRows[0]?.nome ?? `Material #${catalogoId}`;

    await tx.$executeRawUnsafe(
      `INSERT INTO alm_alertas_estoque (tenant_id, local_id, catalogo_id, tipo, nivel, mensagem, criado_at)
       SELECT $1, $2, $3, 'estoque_minimo', $4, $5, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM alm_alertas_estoque
         WHERE tenant_id=$1 AND local_id=$2 AND catalogo_id=$3
           AND tipo='estoque_minimo' AND lido=false
       )`,
      tenantId, localId, catalogoId,
      nivel,
      `${nomeMaterial} — saldo ${nivel === 'critico' ? 'crítico' : 'em atenção'}: ${saldoAtual} (mínimo: ${estoqueMin})`,
    );
  }
}
