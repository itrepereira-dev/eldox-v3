// backend/src/almoxarifado/conversao/conversao.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export class ConversaoNotFoundException extends NotFoundException {
  constructor(origem: string, destino: string) {
    super(
      `Nenhuma regra de conversão encontrada para "${origem}" → "${destino}". ` +
      `Cadastre a regra em Almoxarifado > Configurações > Conversões.`,
    );
  }
}

export interface ConversaoResult {
  quantidade: number;
  fator: number;
}

@Injectable()
export class ConversaoService {
  private readonly logger = new Logger(ConversaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Converte quantidade de unidade_origem para unidade_destino.
   *
   * Cadeia de resolução (ordem de prioridade):
   * 1. tenant_id = X  AND catalogo_id = Y   → regra específica do item no tenant
   * 2. tenant_id = X  AND catalogo_id IS NULL → regra geral do tenant
   * 3. tenant_id = 0  AND catalogo_id = Y   → regra sistema para o item
   * 4. tenant_id = 0  AND catalogo_id IS NULL → regra sistema global
   * 5. unidade_origem == unidade_destino     → fator = 1 (sem conversão)
   * 6. Lança ConversaoNotFoundException
   */
  async converter(
    tenantId: number,
    catalogoId: number | null,
    quantidade: number,
    unidadeOrigem: string,
    unidadeDestino: string,
  ): Promise<ConversaoResult> {
    if (unidadeOrigem === unidadeDestino) {
      return { quantidade, fator: 1 };
    }

    const rows = await this.prisma.$queryRawUnsafe<{ fator: number }[]>(
      `SELECT fator FROM alm_unidades_conversao
       WHERE unidade_origem = $1
         AND unidade_destino = $2
         AND ativo = true
         AND (
           (tenant_id = $3 AND catalogo_id = $4)      -- 1. específico tenant+item
           OR (tenant_id = $3 AND catalogo_id IS NULL) -- 2. geral tenant
           OR (tenant_id = 0  AND catalogo_id = $4)   -- 3. sistema+item
           OR (tenant_id = 0  AND catalogo_id IS NULL) -- 4. sistema global
         )
       ORDER BY
         CASE
           WHEN tenant_id = $3 AND catalogo_id = $4   THEN 1
           WHEN tenant_id = $3 AND catalogo_id IS NULL THEN 2
           WHEN tenant_id = 0  AND catalogo_id = $4   THEN 3
           ELSE 4
         END
       LIMIT 1`,
      unidadeOrigem, unidadeDestino, tenantId, catalogoId,
    );

    if (!rows.length) {
      throw new ConversaoNotFoundException(unidadeOrigem, unidadeDestino);
    }

    const fator = Number(rows[0].fator);
    return { quantidade: quantidade * fator, fator };
  }

  async listConversoes(tenantId: number) {
    return this.prisma.$queryRawUnsafe(
      `SELECT c.*, m.nome AS catalogo_nome
       FROM alm_unidades_conversao c
       LEFT JOIN fvm_catalogo_materiais m ON m.id = c.catalogo_id
       WHERE c.tenant_id IN (0, $1) AND c.ativo = true
       ORDER BY c.tenant_id DESC, m.nome ASC, c.unidade_origem ASC`,
      tenantId,
    );
  }

  async upsertConversao(
    tenantId: number,
    dto: {
      catalogoId?: number | null;
      unidadeOrigem: string;
      unidadeDestino: string;
      fator: number;
      descricao?: string | null;
    },
  ) {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO alm_unidades_conversao
         (tenant_id, catalogo_id, unidade_origem, unidade_destino, fator, descricao)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, COALESCE(catalogo_id, 0), unidade_origem, unidade_destino)
       DO UPDATE SET fator = $5, descricao = $6, ativo = true
       RETURNING id`,
      tenantId,
      dto.catalogoId ?? null,
      dto.unidadeOrigem.toUpperCase(),
      dto.unidadeDestino.toUpperCase(),
      dto.fator,
      dto.descricao ?? null,
    );
    return rows[0];
  }

  /**
   * Cálculo reverso: "Preciso de 250 m² de porcelanato, quantas caixas compro?"
   *
   * Dado uma necessidade em UM de consumo e a UM de compra do fornecedor,
   * retorna quantidade a comprar com arredondamento para cima e opcional
   * quebra técnica (ex: 10% para cobrir perdas de corte/aplicação).
   *
   * Fator convencionado: 1 UM_compra = fator × UM_destino
   * Logo, qtd_compra = necessidade / fator
   */
  async calcularCompra(
    tenantId: number,
    catalogoId: number | null,
    necessidade: number,
    unidadeNecessidade: string,
    unidadeCompra: string,
    quebraPct = 0,
  ): Promise<{
    quantidadeCompra: number;
    quantidadeNominal: number;
    fatorAplicado: number;
    quebraAplicada: number;
  }> {
    const origem = unidadeCompra.toUpperCase();
    const destino = unidadeNecessidade.toUpperCase();

    // Mesmo UM: só aplica quebra + arredondamento
    if (origem === destino) {
      const comQuebra = necessidade * (1 + quebraPct / 100);
      return {
        quantidadeCompra: Math.ceil(comQuebra),
        quantidadeNominal: necessidade,
        fatorAplicado: 1,
        quebraAplicada: quebraPct,
      };
    }

    // Busca fator UM_compra -> UM_necessidade
    // Ex: 1 CX porcelanato = 2.5 M2 → fator = 2.5
    // Necessidade 250 M2 → 250 / 2.5 = 100 CX
    const { fator } = await this.converter(
      tenantId,
      catalogoId,
      1,
      origem,
      destino,
    );

    const qtdNominal = necessidade / fator;
    const comQuebra = qtdNominal * (1 + quebraPct / 100);

    return {
      quantidadeCompra: Math.ceil(comQuebra),
      quantidadeNominal: qtdNominal,
      fatorAplicado: fator,
      quebraAplicada: quebraPct,
    };
  }
}
