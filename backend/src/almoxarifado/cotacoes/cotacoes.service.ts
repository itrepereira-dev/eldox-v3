// backend/src/almoxarifado/cotacoes/cotacoes.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ComprasService } from '../compras/compras.service';

// ── Tipos locais ──────────────────────────────────────────────────────────────

export interface CotacaoResumo {
  id: number;
  solicitacao_id: number;
  fornecedor_id: number;
  fornecedor_nome: string;
  fornecedor_email: string | null;
  status: string;
  prazo_entrega: string | null;
  condicao_pgto: string | null;
  frete: number;
  subtotal: number | null;
  respondida_at: string | null;
  token_expires_at: string | null;
  created_at: string;
}

export interface CotacaoDetalhe extends CotacaoResumo {
  itens: CotacaoItemDetalhe[];
}

export interface CotacaoItemDetalhe {
  id: number;
  catalogo_id: number;
  catalogo_nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number | null;
  marca: string | null;
  disponivel: boolean;
  prazo_dias: number | null;
  observacao: string | null;
}

export interface ComparativoItem {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  quantidade: number;
  propostas: {
    cotacao_id: number;
    fornecedor_id: number;
    fornecedor_nome: string;
    preco_unitario: number | null;
    prazo_dias: number | null;
    disponivel: boolean;
    total_item: number | null;
    melhor_preco: boolean;
  }[];
  menor_preco: number | null;
  melhor_cotacao_id: number | null;
  economia_pct: number | null; // % de economia vs. maior preço
}

export interface CurvaAbcItem {
  catalogo_id: number;
  catalogo_nome: string;
  valor_total: number;
  percentual: number;
  percentual_acumulado: number;
  classificacao: 'A' | 'B' | 'C';
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CotacoesService {
  private readonly logger = new Logger(CotacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly compras: ComprasService,
  ) {}

  // ── Criar cotação para um fornecedor ─────────────────────────────────────────
  // Cria a cotação já com os itens da solicitação, prontos para o fornecedor preencher.

  async criar(
    tenantId: number,
    solicitacaoId: number,
    fornecedorId: number,
    dto: { validade_dias?: number; observacao?: string },
  ): Promise<CotacaoResumo> {
    // Valida que a solicitação pertence ao tenant e está em estado cotável
    const sol = await this.prisma.$queryRawUnsafe<{ id: number; status: string; obra_id: number }[]>(
      `SELECT id, status, obra_id FROM alm_solicitacoes WHERE id = $1 AND tenant_id = $2`,
      solicitacaoId, tenantId,
    );
    if (!sol.length) throw new NotFoundException(`Solicitação ${solicitacaoId} não encontrada`);
    if (!['aprovada', 'em_cotacao'].includes(sol[0].status)) {
      throw new BadRequestException(`Solicitação deve estar aprovada para iniciar cotação (status atual: ${sol[0].status})`);
    }

    // Valida fornecedor
    const forn = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM fvm_fornecedores WHERE id = $1 AND tenant_id = $2`,
      fornecedorId, tenantId,
    );
    if (!forn.length) throw new NotFoundException(`Fornecedor ${fornecedorId} não encontrado`);

    // Verifica se já existe cotação para este fornecedor nesta solicitação
    const jaExiste = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_cotacoes WHERE solicitacao_id = $1 AND fornecedor_id = $2 AND status NOT IN ('cancelada')`,
      solicitacaoId, fornecedorId,
    );
    if (jaExiste.length) {
      throw new ConflictException(`Já existe cotação ativa para este fornecedor nesta solicitação`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Cria a cotação
      const cotacao = await tx.$queryRawUnsafe<CotacaoResumo[]>(
        `INSERT INTO alm_cotacoes
           (tenant_id, solicitacao_id, fornecedor_id, status, validade_dias, observacao)
         VALUES ($1, $2, $3, 'em_preenchimento', $4, $5)
         RETURNING *`,
        tenantId, solicitacaoId, fornecedorId,
        dto.validade_dias ?? 7,
        dto.observacao ?? null,
      );

      // Copia os itens da solicitação para a cotação (sem preços — fornecedor vai preencher)
      const itens = await tx.$queryRawUnsafe<{ catalogo_id: number; quantidade: number; unidade: string }[]>(
        `SELECT catalogo_id, quantidade, unidade FROM alm_solicitacao_itens WHERE solicitacao_id = $1`,
        solicitacaoId,
      );

      for (const item of itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_cotacao_itens (cotacao_id, catalogo_id, quantidade, unidade)
           VALUES ($1, $2, $3, $4)`,
          cotacao[0].id, item.catalogo_id, item.quantidade, item.unidade,
        );
      }

      // Atualiza status da solicitação para em_cotacao
      await tx.$executeRawUnsafe(
        `UPDATE alm_solicitacoes SET status = 'em_cotacao', updated_at = NOW()
         WHERE id = $1 AND status = 'aprovada'`,
        solicitacaoId,
      );

      this.logger.log(JSON.stringify({
        action: 'cotacao.criada', tenantId, cotacaoId: cotacao[0].id,
        solicitacaoId, fornecedorId,
      }));

      return cotacao[0];
    });
  }

  // ── Enviar cotação ao fornecedor ──────────────────────────────────────────────
  // Gera token único e retorna o link para o portal público.

  async enviar(tenantId: number, cotacaoId: number): Promise<{ token: string; link: string }> {
    const rows = await this.prisma.$queryRawUnsafe<CotacaoResumo[]>(
      `SELECT c.*, f.email AS fornecedor_email, f.nome_fantasia AS fornecedor_nome
       FROM alm_cotacoes c
       JOIN fvm_fornecedores f ON f.id = c.fornecedor_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      cotacaoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Cotação ${cotacaoId} não encontrada`);
    if (rows[0].status === 'respondida') {
      throw new BadRequestException('Cotação já foi respondida');
    }

    const token  = randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + (rows[0] as any).validade_dias * 24 * 60 * 60 * 1000);

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_cotacoes
       SET token = $1, token_expires_at = $2, status = 'enviada', updated_at = NOW()
       WHERE id = $3`,
      token, expira, cotacaoId,
    );

    const link = `${process.env.FRONTEND_URL ?? 'https://app.eldox.com.br'}/portal/cotacao/${token}`;

    this.logger.log(JSON.stringify({
      action: 'cotacao.enviada', tenantId, cotacaoId,
      fornecedorEmail: rows[0].fornecedor_email,
    }));

    return { token, link };
  }

  // ── Listar cotações de uma solicitação ────────────────────────────────────────

  async listar(tenantId: number, solicitacaoId: number): Promise<CotacaoResumo[]> {
    return this.prisma.$queryRawUnsafe<CotacaoResumo[]>(
      `SELECT c.*,
              f.nome_fantasia  AS fornecedor_nome,
              f.email          AS fornecedor_email,
              COUNT(ci.id)::int AS total_itens,
              COUNT(CASE WHEN ci.preco_unitario IS NOT NULL THEN 1 END)::int AS itens_respondidos
       FROM alm_cotacoes c
       JOIN fvm_fornecedores f ON f.id = c.fornecedor_id
       LEFT JOIN alm_cotacao_itens ci ON ci.cotacao_id = c.id
       WHERE c.tenant_id = $1 AND c.solicitacao_id = $2
       GROUP BY c.id, f.nome_fantasia, f.email
       ORDER BY c.created_at DESC`,
      tenantId, solicitacaoId,
    );
  }

  // ── Detalhe ───────────────────────────────────────────────────────────────────

  async buscar(tenantId: number, cotacaoId: number): Promise<CotacaoDetalhe> {
    const rows = await this.prisma.$queryRawUnsafe<CotacaoResumo[]>(
      `SELECT c.*, f.nome_fantasia AS fornecedor_nome, f.email AS fornecedor_email
       FROM alm_cotacoes c
       JOIN fvm_fornecedores f ON f.id = c.fornecedor_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      cotacaoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Cotação ${cotacaoId} não encontrada`);

    const itens = await this._getItens(cotacaoId);
    return { ...rows[0], itens };
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────────

  async cancelar(tenantId: number, cotacaoId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number; status: string }[]>(
      `SELECT id, status FROM alm_cotacoes WHERE id = $1 AND tenant_id = $2`,
      cotacaoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Cotação ${cotacaoId} não encontrada`);
    if (rows[0].status === 'selecionada') {
      throw new BadRequestException('Cotação selecionada não pode ser cancelada');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_cotacoes SET status = 'cancelada', updated_at = NOW() WHERE id = $1`,
      cotacaoId,
    );
  }

  // ── Portal público: buscar por token ─────────────────────────────────────────

  async buscarPorToken(token: string): Promise<{
    cotacao: CotacaoResumo & { solicitacao_numero: string; obra_nome: string };
    itens: CotacaoItemDetalhe[];
  }> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT c.*,
              f.nome_fantasia AS fornecedor_nome,
              f.email         AS fornecedor_email,
              s.numero        AS solicitacao_numero,
              o.nome          AS obra_nome
       FROM alm_cotacoes c
       JOIN fvm_fornecedores f ON f.id = c.fornecedor_id
       JOIN alm_solicitacoes s ON s.id = c.solicitacao_id
       JOIN "Obra" o ON o.id = s.obra_id
       WHERE c.token = $1`,
      token,
    );

    if (!rows.length) throw new NotFoundException('Link de cotação inválido ou expirado');

    const cotacao = rows[0];
    if (cotacao.token_expires_at && new Date(cotacao.token_expires_at) < new Date()) {
      throw new BadRequestException('Este link de cotação expirou. Solicite um novo link ao comprador.');
    }
    if (['cancelada', 'selecionada'].includes(cotacao.status)) {
      throw new BadRequestException('Esta cotação não está mais disponível para preenchimento.');
    }

    const itens = await this._getItens(cotacao.id);
    return { cotacao, itens };
  }

  // ── Portal público: fornecedor preenche os preços ─────────────────────────────

  async responderCotacao(
    token: string,
    data: {
      prazo_entrega?: string;
      condicao_pgto?: string;
      frete?: number;
      itens: { cotacao_item_id: number; preco_unitario: number | null; marca?: string; disponivel?: boolean; prazo_dias?: number; observacao?: string }[];
    },
  ): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number; status: string; token_expires_at: string | null }[]>(
      `SELECT id, status, token_expires_at FROM alm_cotacoes WHERE token = $1`,
      token,
    );
    if (!rows.length) throw new NotFoundException('Link inválido');

    const c = rows[0];
    if (c.token_expires_at && new Date(c.token_expires_at) < new Date()) {
      throw new BadRequestException('Link expirado');
    }
    if (c.status === 'cancelada') throw new BadRequestException('Cotação cancelada');

    await this.prisma.$transaction(async (tx) => {
      // Atualiza cabeçalho da cotação
      const subtotal = data.itens.reduce(
        (acc, i) => acc + (i.preco_unitario ?? 0),
        0,
      );

      await tx.$executeRawUnsafe(
        `UPDATE alm_cotacoes
         SET prazo_entrega  = $1,
             condicao_pgto  = $2,
             frete          = $3,
             subtotal       = $4,
             status         = 'respondida',
             respondida_at  = NOW(),
             updated_at     = NOW()
         WHERE id = $5`,
        data.prazo_entrega ?? null,
        data.condicao_pgto ?? null,
        data.frete ?? 0,
        subtotal,
        c.id,
      );

      // Atualiza cada item
      for (const item of data.itens) {
        await tx.$executeRawUnsafe(
          `UPDATE alm_cotacao_itens
           SET preco_unitario = $1,
               marca          = $2,
               disponivel     = $3,
               prazo_dias     = $4,
               observacao     = $5
           WHERE id = $6 AND cotacao_id = $7`,
          item.preco_unitario ?? null,
          item.marca ?? null,
          item.disponivel ?? true,
          item.prazo_dias ?? null,
          item.observacao ?? null,
          item.cotacao_item_id,
          c.id,
        );
      }
    });

    this.logger.log(JSON.stringify({ action: 'cotacao.respondida', cotacaoId: c.id }));
  }

  // ── Comparativo de preços por item ───────────────────────────────────────────

  async getComparativo(tenantId: number, solicitacaoId: number): Promise<ComparativoItem[]> {
    // Itens com propostas de todos os fornecedores (só cotações respondidas)
    const rows = await this.prisma.$queryRawUnsafe<{
      catalogo_id: number; catalogo_nome: string; unidade: string; quantidade: number;
      cotacao_id: number; fornecedor_id: number; fornecedor_nome: string;
      preco_unitario: number | null; prazo_dias: number | null; disponivel: boolean;
    }[]>(
      `SELECT
         si.catalogo_id,
         m.nome              AS catalogo_nome,
         si.unidade,
         si.quantidade,
         c.id                AS cotacao_id,
         f.id                AS fornecedor_id,
         f.nome_fantasia     AS fornecedor_nome,
         ci.preco_unitario,
         ci.prazo_dias,
         COALESCE(ci.disponivel, true) AS disponivel
       FROM alm_solicitacao_itens si
       JOIN fvm_catalogo_materiais m ON m.id = si.catalogo_id
       JOIN alm_cotacoes c ON c.solicitacao_id = si.solicitacao_id
       JOIN fvm_fornecedores f ON f.id = c.fornecedor_id
       LEFT JOIN alm_cotacao_itens ci ON ci.cotacao_id = c.id AND ci.catalogo_id = si.catalogo_id
       WHERE si.solicitacao_id = $1
         AND c.tenant_id = $2
         AND c.status = 'respondida'
       ORDER BY si.catalogo_id, ci.preco_unitario ASC NULLS LAST`,
      solicitacaoId, tenantId,
    );

    // Agrupa por item
    const map = new Map<number, ComparativoItem>();

    for (const r of rows) {
      if (!map.has(r.catalogo_id)) {
        map.set(r.catalogo_id, {
          catalogo_id: r.catalogo_id,
          catalogo_nome: r.catalogo_nome,
          unidade: r.unidade,
          quantidade: Number(r.quantidade),
          propostas: [],
          menor_preco: null,
          melhor_cotacao_id: null,
          economia_pct: null,
        });
      }
      const entry = map.get(r.catalogo_id)!;
      entry.propostas.push({
        cotacao_id: r.cotacao_id,
        fornecedor_id: r.fornecedor_id,
        fornecedor_nome: r.fornecedor_nome,
        preco_unitario: r.preco_unitario !== null ? Number(r.preco_unitario) : null,
        prazo_dias: r.prazo_dias !== null ? Number(r.prazo_dias) : null,
        disponivel: r.disponivel,
        total_item: r.preco_unitario !== null ? Number(r.preco_unitario) * Number(r.quantidade) : null,
        melhor_preco: false,
      });
    }

    // Calcula melhor preço por item
    for (const item of map.values()) {
      const precos = item.propostas
        .filter((p) => p.preco_unitario !== null && p.disponivel)
        .sort((a, b) => a.preco_unitario! - b.preco_unitario!);

      if (precos.length) {
        item.menor_preco = precos[0].preco_unitario;
        item.melhor_cotacao_id = precos[0].cotacao_id;

        // Marca o melhor
        item.propostas.forEach((p) => {
          p.melhor_preco = p.cotacao_id === item.melhor_cotacao_id && p.preco_unitario === item.menor_preco;
        });

        // Economia vs. maior preço
        const maior = precos[precos.length - 1].preco_unitario!;
        if (maior > 0 && item.menor_preco! < maior) {
          item.economia_pct = Math.round(((maior - item.menor_preco!) / maior) * 100);
        }
      }
    }

    return Array.from(map.values());
  }

  // ── Curva ABC ────────────────────────────────────────────────────────────────

  async getCurvaAbc(tenantId: number, solicitacaoId: number): Promise<CurvaAbcItem[]> {
    const comparativo = await this.getComparativo(tenantId, solicitacaoId);

    // Calcula valor total por item (menor preço × quantidade)
    const itens = comparativo
      .filter((i) => i.menor_preco !== null)
      .map((i) => ({
        catalogo_id: i.catalogo_id,
        catalogo_nome: i.catalogo_nome,
        valor_total: i.menor_preco! * i.quantidade,
      }))
      .sort((a, b) => b.valor_total - a.valor_total);

    const totalGeral = itens.reduce((acc, i) => acc + i.valor_total, 0);
    if (totalGeral === 0) return [];

    let acumulado = 0;
    return itens.map((i) => {
      const percentual = (i.valor_total / totalGeral) * 100;
      acumulado += percentual;
      return {
        catalogo_id: i.catalogo_id,
        catalogo_nome: i.catalogo_nome,
        valor_total: Math.round(i.valor_total * 100) / 100,
        percentual: Math.round(percentual * 100) / 100,
        percentual_acumulado: Math.round(acumulado * 100) / 100,
        classificacao: acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C',
      } as CurvaAbcItem;
    });
  }

  // ── Gerar OC(s) a partir das cotações ────────────────────────────────────────
  // modo: 'automatico' = menor preço por item, agrupado por fornecedor
  // modo: 'manual' = usuário informa qual cotacao_id escolheu por item

  async gerarOcs(
    tenantId: number,
    solicitacaoId: number,
    usuarioId: number,
    dto: {
      modo: 'automatico' | 'manual';
      selecoes?: { catalogo_id: number; cotacao_id: number }[];  // para modo manual
      local_entrega?: string;
      condicao_pgto_override?: string;
    },
  ): Promise<{ ocs_criadas: number; ids: number[] }> {
    // Resolve seleção por item
    let selecoesPorItem: Map<number, number>;  // catalogo_id → cotacao_id

    if (dto.modo === 'automatico') {
      const comparativo = await this.getComparativo(tenantId, solicitacaoId);
      selecoesPorItem = new Map(
        comparativo
          .filter((i) => i.melhor_cotacao_id !== null)
          .map((i) => [i.catalogo_id, i.melhor_cotacao_id!]),
      );
    } else {
      if (!dto.selecoes?.length) {
        throw new BadRequestException('No modo manual, informe as seleções por item');
      }
      selecoesPorItem = new Map(dto.selecoes.map((s) => [s.catalogo_id, s.cotacao_id]));
    }

    if (!selecoesPorItem.size) {
      throw new BadRequestException('Nenhum item com preço disponível para gerar OC');
    }

    // Agrupa itens por fornecedor (uma OC por fornecedor)
    const porFornecedor = new Map<number, {
      cotacaoId: number;
      fornecedorId: number;
      prazoEntrega: string | null;
      condicaoPgto: string | null;
      itens: { catalogo_id: number; quantidade: number; unidade: string; preco_unitario: number }[];
    }>();

    for (const [catalogoId, cotacaoId] of selecoesPorItem) {
      // Busca dados da cotação
      const cotRow = await this.prisma.$queryRawUnsafe<{
        fornecedor_id: number; prazo_entrega: string | null; condicao_pgto: string | null;
      }[]>(
        `SELECT fornecedor_id, prazo_entrega::text, condicao_pgto
         FROM alm_cotacoes WHERE id = $1 AND tenant_id = $2`,
        cotacaoId, tenantId,
      );
      if (!cotRow.length) continue;

      const { fornecedor_id, prazo_entrega, condicao_pgto } = cotRow[0];

      const itemRow = await this.prisma.$queryRawUnsafe<{
        quantidade: number; unidade: string; preco_unitario: number;
      }[]>(
        `SELECT quantidade, unidade, preco_unitario
         FROM alm_cotacao_itens WHERE cotacao_id = $1 AND catalogo_id = $2`,
        cotacaoId, catalogoId,
      );
      if (!itemRow.length || itemRow[0].preco_unitario == null) continue;

      if (!porFornecedor.has(fornecedor_id)) {
        porFornecedor.set(fornecedor_id, {
          cotacaoId,
          fornecedorId: fornecedor_id,
          prazoEntrega: prazo_entrega,
          condicaoPgto: dto.condicao_pgto_override ?? condicao_pgto,
          itens: [],
        });
      }
      porFornecedor.get(fornecedor_id)!.itens.push({
        catalogo_id: catalogoId,
        quantidade: Number(itemRow[0].quantidade),
        unidade: itemRow[0].unidade,
        preco_unitario: Number(itemRow[0].preco_unitario),
      });
    }

    // Busca local_destino_id da solicitação
    const solRow = await this.prisma.$queryRawUnsafe<{ local_destino_id: number }[]>(
      `SELECT local_destino_id FROM alm_solicitacoes WHERE id = $1 AND tenant_id = $2`,
      solicitacaoId, tenantId,
    );
    if (!solRow.length) throw new NotFoundException('Solicitação não encontrada');
    const localDestinoId = solRow[0].local_destino_id;

    // Cria uma OC por fornecedor
    const idsOcs: number[] = [];

    for (const grupo of porFornecedor.values()) {
      const oc = await this.compras.criar(tenantId, usuarioId, {
        fornecedor_id:    grupo.fornecedorId,
        local_destino_id: localDestinoId,
        solicitacao_id:   solicitacaoId,
        prazo_entrega:    grupo.prazoEntrega ?? undefined,
        condicao_pgto:    grupo.condicaoPgto ?? undefined,
        local_entrega:    dto.local_entrega,
        itens:            grupo.itens,
      });

      // Vincula cotacao_id na OC para rastreabilidade
      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_ordens_compra SET cotacao_id = $1 WHERE id = $2`,
        grupo.cotacaoId, (oc as any).id,
      );

      // Marca cotação como selecionada
      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_cotacoes SET status = 'selecionada', selecionada_por = $1, updated_at = NOW()
         WHERE id = $2`,
        usuarioId, grupo.cotacaoId,
      );

      idsOcs.push((oc as any).id);
    }

    // Atualiza status da solicitação
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_solicitacoes SET status = 'oc_gerada', updated_at = NOW() WHERE id = $1`,
      solicitacaoId,
    );

    this.logger.log(JSON.stringify({
      action: 'cotacao.ocs_geradas', tenantId, solicitacaoId,
      ocs: idsOcs.length, ids: idsOcs,
    }));

    return { ocs_criadas: idsOcs.length, ids: idsOcs };
  }

  // ── Helper privado: itens com nomes ──────────────────────────────────────────

  private async _getItens(cotacaoId: number): Promise<CotacaoItemDetalhe[]> {
    return this.prisma.$queryRawUnsafe<CotacaoItemDetalhe[]>(
      `SELECT ci.*, m.nome AS catalogo_nome
       FROM alm_cotacao_itens ci
       JOIN fvm_catalogo_materiais m ON m.id = ci.catalogo_id
       WHERE ci.cotacao_id = $1
       ORDER BY ci.id`,
      cotacaoId,
    );
  }
}
