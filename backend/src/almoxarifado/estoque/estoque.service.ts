// backend/src/almoxarifado/estoque/estoque.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmEstoqueSaldo, AlmMovimento, AlmAlertaEstoque } from '../types/alm.types';
// Type helper: tabela `alm_estoque_locais` foi removida no sprint Almoxarifado
// ERP, mas os métodos getLocais/createLocal continuam referenciados por código
// legado. Mantidos com tipo genérico até serem reescritos para alm_locais.
type AlmEstoqueLocal = AlmEstoqueSaldo;
import type { CreateMovimentoDto } from './dto/create-movimento.dto';
import type { TransferenciaDto } from './dto/transferencia.dto';

@Injectable()
export class EstoqueService {
  private readonly logger = new Logger(EstoqueService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Locais ────────────────────────────────────────────────────────────────

  async getLocais(tenantId: number, obraId: number): Promise<AlmEstoqueLocal[]> {
    return this.prisma.$queryRawUnsafe<AlmEstoqueLocal[]>(
      `SELECT * FROM alm_estoque_locais
       WHERE tenant_id = $1 AND obra_id = $2 AND ativo = true
       ORDER BY nome ASC`,
      tenantId, obraId,
    );
  }

  async createLocal(tenantId: number, obraId: number, dto: { nome: string; descricao?: string }) {
    const rows = await this.prisma.$queryRawUnsafe<AlmEstoqueLocal[]>(
      `INSERT INTO alm_estoque_locais (tenant_id, obra_id, nome, descricao)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      tenantId, obraId, dto.nome, dto.descricao ?? null,
    );
    return rows[0];
  }

  // ── Saldo ─────────────────────────────────────────────────────────────────

  async getSaldo(
    tenantId: number,
    obraId: number,
    filters: { localId?: number; catalogoId?: number; nivel?: string } = {},
  ): Promise<AlmEstoqueSaldo[]> {
    const conditions: string[] = [
      `s.tenant_id = $1`,
      `s.obra_id = $2`,
    ];
    const params: unknown[] = [tenantId, obraId];
    let i = 3;

    if (filters.localId) {
      conditions.push(`s.local_id = $${i++}`);
      params.push(filters.localId);
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
              CASE
                WHEN s.estoque_min > 0 AND s.quantidade <= s.estoque_min * 0.3 THEN 'critico'
                WHEN s.estoque_min > 0 AND s.quantidade <= s.estoque_min       THEN 'atencao'
                ELSE 'normal'
              END AS nivel
       FROM alm_estoque_saldo s
       JOIN fvm_catalogo_materiais m ON m.id = s.catalogo_id
       LEFT JOIN alm_estoque_locais l ON l.id = s.local_id
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
    obraId: number,
    filters: { catalogoId?: number; tipo?: string; limit?: number; offset?: number } = {},
  ): Promise<AlmMovimento[]> {
    const conditions: string[] = [`mv.tenant_id = $1`, `mv.obra_id = $2`];
    const params: unknown[] = [tenantId, obraId];
    let i = 3;

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

    return this.prisma.$queryRawUnsafe<AlmMovimento[]>(
      `SELECT mv.*,
              m.nome  AS catalogo_nome,
              l.nome  AS local_nome,
              u.nome  AS usuario_nome
       FROM alm_movimentos mv
       JOIN fvm_catalogo_materiais m ON m.id = mv.catalogo_id
       LEFT JOIN alm_estoque_locais  l ON l.id = mv.local_id
       LEFT JOIN "Usuario"             u ON u.id = mv.criado_por
       WHERE ${conditions.join(' AND ')}
       ORDER BY mv.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      ...params, limit, offset,
    );
  }

  /**
   * Registra um movimento de estoque e atualiza o saldo correspondente.
   * Usa transação do Prisma para garantir atomicidade.
   */
  async registrarMovimento(
    tenantId: number,
    obraId: number,
    usuarioId: number,
    dto: CreateMovimentoDto,
  ): Promise<AlmMovimento> {
    // Verifica se a obra não está encerrada
    const obras = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM "Obra" WHERE id = $1 AND "tenantId" = $2`,
      obraId, tenantId,
    );
    if (!obras.length) throw new NotFoundException('Obra não encontrada');
    if (obras[0].status === 'encerrada') {
      throw new BadRequestException('Obras encerradas não permitem movimentações de estoque');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lê saldo atual (cria se não existir)
      const saldoRows = await tx.$queryRawUnsafe<{ id: number; quantidade: number }[]>(
        `INSERT INTO alm_estoque_saldo (tenant_id, obra_id, catalogo_id, local_id, quantidade, unidade)
         VALUES ($1, $2, $3, $4, 0, $5)
         ON CONFLICT (tenant_id, obra_id, catalogo_id, COALESCE(local_id, 0))
         DO UPDATE SET id = alm_estoque_saldo.id
         RETURNING id, quantidade::float`,
        tenantId, obraId, dto.catalogo_id, dto.local_id ?? null, dto.unidade,
      );

      const saldoAnterior = Number(saldoRows[0].quantidade);
      const delta = ['saida', 'perda'].includes(dto.tipo)
        ? -dto.quantidade
        : dto.quantidade;

      if (delta < 0 && saldoAnterior + delta < 0) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${saldoAnterior} ${dto.unidade}`,
        );
      }

      const saldoPosterior = saldoAnterior + delta;

      // Atualiza saldo
      await tx.$executeRawUnsafe(
        `UPDATE alm_estoque_saldo
         SET quantidade = $1, updated_at = NOW()
         WHERE id = $2`,
        saldoPosterior, saldoRows[0].id,
      );

      // Insere movimento no ledger
      const movRows = await tx.$queryRawUnsafe<AlmMovimento[]>(
        `INSERT INTO alm_movimentos
           (tenant_id, obra_id, catalogo_id, local_id, tipo, quantidade, unidade,
            saldo_anterior, saldo_posterior, referencia_tipo, referencia_id, observacao, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        tenantId, obraId, dto.catalogo_id, dto.local_id ?? null, dto.tipo,
        dto.quantidade, dto.unidade, saldoAnterior, saldoPosterior,
        dto.referencia_tipo ?? null, dto.referencia_id ?? null,
        dto.observacao ?? null, usuarioId,
      );

      // Verifica alertas de estoque mínimo após saída/perda
      if (['saida', 'perda'].includes(dto.tipo)) {
        await this.avaliarAlertaEstoqueMinimo(
          tx as any, tenantId, obraId, dto.catalogo_id, dto.local_id ?? null, saldoPosterior,
        );
      }

      this.logger.log(JSON.stringify({
        action: 'alm.estoque.movimento',
        tenantId, obraId, tipo: dto.tipo,
        catalogoId: dto.catalogo_id, quantidade: dto.quantidade,
        saldoAnterior, saldoPosterior,
      }));

      return movRows[0];
    });
  }

  /**
   * Transferência atômica entre obras (ou locais).
   * Débito na origem + Crédito no destino na mesma transação.
   */
  async transferir(
    tenantId: number,
    obraOrigemId: number,
    usuarioId: number,
    dto: TransferenciaDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Saída da origem
      await this.registrarMovimento(tenantId, obraOrigemId, usuarioId, {
        catalogo_id: dto.catalogo_id,
        tipo: 'transferencia',
        quantidade: dto.quantidade,
        unidade: dto.unidade,
        local_id: dto.local_origem_id,
        referencia_tipo: 'transferencia',
        observacao: dto.observacao ?? `Transferência para obra #${dto.obra_destino_id}`,
      });

      // Entrada no destino
      await this.registrarMovimento(tenantId, dto.obra_destino_id, usuarioId, {
        catalogo_id: dto.catalogo_id,
        tipo: 'entrada',
        quantidade: dto.quantidade,
        unidade: dto.unidade,
        local_id: dto.local_destino_id,
        referencia_tipo: 'transferencia',
        observacao: dto.observacao ?? `Transferência de obra #${obraOrigemId}`,
      });
    });
  }

  // ── Alertas ───────────────────────────────────────────────────────────────

  async getAlertas(tenantId: number, obraId: number, apenasNaoLidos = true): Promise<AlmAlertaEstoque[]> {
    return this.prisma.$queryRawUnsafe<AlmAlertaEstoque[]>(
      `SELECT a.*, m.nome AS catalogo_nome
       FROM alm_alertas_estoque a
       JOIN fvm_catalogo_materiais m ON m.id = a.catalogo_id
       WHERE a.tenant_id = $1 AND a.obra_id = $2
         ${apenasNaoLidos ? 'AND a.lido = false' : ''}
       ORDER BY
         CASE a.nivel WHEN 'critico' THEN 1 ELSE 2 END,
         a.criado_at DESC`,
      tenantId, obraId,
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

  async marcarTodosLidos(tenantId: number, obraId: number, usuarioId: number): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_alertas_estoque
       SET lido = true, lido_por = $1, lido_at = NOW()
       WHERE tenant_id = $2 AND obra_id = $3 AND lido = false`,
      usuarioId, tenantId, obraId,
    );
  }

  // ── Dashboard KPIs ────────────────────────────────────────────────────────

  async getDashboardKpis(tenantId: number, obraId: number) {
    const [estoqueMin, solPendentes, nfePendente, ocAberto, conformidade] =
      await Promise.all([
        this.prisma.$queryRawUnsafe<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM alm_alertas_estoque
           WHERE tenant_id = $1 AND obra_id = $2 AND lido = false AND nivel = 'critico'`,
          tenantId, obraId,
        ),
        this.prisma.$queryRawUnsafe<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM alm_solicitacoes
           WHERE tenant_id = $1 AND obra_id = $2 AND status = 'aguardando_aprovacao'`,
          tenantId, obraId,
        ),
        this.prisma.$queryRawUnsafe<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM alm_notas_fiscais
           WHERE tenant_id = $1 AND obra_id = $2 AND status = 'pendente_match'`,
          tenantId, obraId,
        ),
        this.prisma.$queryRawUnsafe<{ total: number }[]>(
          `SELECT COALESCE(SUM(valor_total), 0)::float AS total
           FROM alm_ordens_compra
           WHERE tenant_id = $1 AND obra_id = $2 AND status IN ('emitida','parcialmente_recebida')`,
          tenantId, obraId,
        ),
        this.prisma.$queryRawUnsafe<{ pct: number }[]>(
          `SELECT CASE WHEN COUNT(*) = 0 THEN 100
                       ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'aceita') / COUNT(*))
                  END::int AS pct
           FROM alm_notas_fiscais
           WHERE tenant_id = $1 AND obra_id = $2
             AND created_at > NOW() - INTERVAL '30 days'`,
          tenantId, obraId,
        ),
      ]);

    return {
      itens_estoque_minimo:        estoqueMin[0]?.count       ?? 0,
      solicitacoes_pendentes:      solPendentes[0]?.count     ?? 0,
      nfe_aguardando_match:        nfePendente[0]?.count      ?? 0,
      valor_oc_aberto:             ocAberto[0]?.total         ?? 0,
      conformidade_recebimento_pct: conformidade[0]?.pct      ?? 100,
    };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async avaliarAlertaEstoqueMinimo(
    tx: PrismaService,
    tenantId: number,
    obraId: number,
    catalogoId: number,
    localId: number | null,
    saldoAtual: number,
  ): Promise<void> {
    const saldoRows = await tx.$queryRawUnsafe<{ estoque_min: number }[]>(
      `SELECT estoque_min::float FROM alm_estoque_saldo
       WHERE tenant_id = $1 AND obra_id = $2 AND catalogo_id = $3 AND COALESCE(local_id, 0) = $4`,
      tenantId, obraId, catalogoId, localId ?? 0,
    );

    if (!saldoRows.length || saldoRows[0].estoque_min <= 0) return;

    const estoqueMin = saldoRows[0].estoque_min;
    const nivel = saldoAtual <= estoqueMin * 0.3 ? 'critico' : saldoAtual <= estoqueMin ? 'atencao' : null;

    if (!nivel) return;

    const materialRows = await tx.$queryRawUnsafe<{ nome: string }[]>(
      `SELECT nome FROM fvm_catalogo_materiais WHERE id = $1`,
      catalogoId,
    );
    const nomeMatrial = materialRows[0]?.nome ?? `Material #${catalogoId}`;

    // Insere alerta (ignora duplicata não lida do mesmo tipo)
    await tx.$executeRawUnsafe(
      `INSERT INTO alm_alertas_estoque (tenant_id, obra_id, catalogo_id, local_id, tipo, nivel, mensagem)
       SELECT $1, $2, $3, $4, 'estoque_minimo', $5, $6
       WHERE NOT EXISTS (
         SELECT 1 FROM alm_alertas_estoque
         WHERE tenant_id=$1 AND obra_id=$2 AND catalogo_id=$3
           AND tipo='estoque_minimo' AND lido=false
       )`,
      tenantId, obraId, catalogoId, localId,
      nivel,
      `${nomeMatrial} — saldo ${nivel === 'critico' ? 'crítico' : 'em atenção'}: ${saldoAtual} (mínimo: ${estoqueMin})`,
    );
  }
}
