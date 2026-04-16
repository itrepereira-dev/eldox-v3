// backend/src/almoxarifado/ia/agente-catalogo.service.ts
//
// Agente IA para identificar produtos similares e sugerir agrupamento em um mesmo
// código de catálogo, mesmo quando chegam com nomes/marcas diferentes nas NF-es.
//
// Fluxo:
//   1. Recebe uma descrição de produto (xprod da NF ou descrição do orçamento)
//   2. Busca primeiro em alm_catalogo_variantes (correspondências já confirmadas)
//   3. Se encontrar — retorna diretamente (sem IA)
//   4. Se não — busca candidatos no catálogo via full-text + SINAPI
//   5. Chama Claude com candidatos e produto para sugerir correspondência
//   6. Salva sugestão em alm_catalogo_sugestoes_ia para aprovação do almoxarife
//   7. Retorna a sugestão com flag precisa_confirmacao = true

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IaService } from '../../ia/ia.service';

const SISTEMA_USUARIO_ID = 1;

export interface MatchResult {
  catalogo_id: number | null;
  catalogo_nome: string | null;
  fator_conversao: number;
  unidade_catalogo: string | null;
  confianca: number;           // 0-100
  precisa_confirmacao: boolean;
  sugestao_id: number | null;  // alm_catalogo_sugestoes_ia.id se precisar confirmação
  origem: 'variante_confirmada' | 'ia' | 'sem_match';
  motivo: string;
}

interface CandidatosCatalogo {
  id: number;
  nome: string;
  codigo: string | null;
  sinapi_codigo: string | null;
  unidade: string;
}

@Injectable()
export class AgenteCatalogoService {
  private readonly logger = new Logger(AgenteCatalogoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
  ) {}

  /**
   * Ponto de entrada principal: dado um produto da NF, retorna a melhor correspondência
   * no catálogo do tenant, usando variantes conhecidas ou IA.
   */
  async identificarProduto(
    tenantId: number,
    descricaoOrig: string,
    unidadeOrig: string | null,
    nfeItemId: number | null = null,
  ): Promise<MatchResult> {
    const descNorm = descricaoOrig.trim().toUpperCase();

    // ── 1. Busca em variantes confirmadas ──────────────────────────────────────
    const varianteExata = await this._buscarVarianteExata(tenantId, descNorm);
    if (varianteExata) {
      return {
        catalogo_id: varianteExata.catalogo_id,
        catalogo_nome: varianteExata.catalogo_nome,
        fator_conversao: varianteExata.fator_conversao,
        unidade_catalogo: varianteExata.unidade,
        confianca: 100,
        precisa_confirmacao: false,
        sugestao_id: null,
        origem: 'variante_confirmada',
        motivo: 'Correspondência exata com variante confirmada anteriormente',
      };
    }

    // ── 2. Busca fuzzy em variantes (similaridade textual) ────────────────────
    const varianteFuzzy = await this._buscarVarianteFuzzy(tenantId, descNorm);
    if (varianteFuzzy && varianteFuzzy.score >= 0.85) {
      // Alta confiança no fuzzy — ainda pede confirmação
      const sugestaoId = await this._salvarSugestao(
        tenantId, descricaoOrig, unidadeOrig,
        varianteFuzzy.catalogo_id, varianteFuzzy.fator_conversao,
        varianteFuzzy.score * 100,
        `Similar a "${varianteFuzzy.descricao_orig}" (confiança ${Math.round(varianteFuzzy.score * 100)}%)`,
        null, nfeItemId,
      );
      return {
        catalogo_id: varianteFuzzy.catalogo_id,
        catalogo_nome: varianteFuzzy.catalogo_nome,
        fator_conversao: varianteFuzzy.fator_conversao,
        unidade_catalogo: varianteFuzzy.unidade,
        confianca: Math.round(varianteFuzzy.score * 100),
        precisa_confirmacao: true,
        sugestao_id: sugestaoId,
        origem: 'ia',
        motivo: `Similar a variante conhecida: "${varianteFuzzy.descricao_orig}"`,
      };
    }

    // ── 3. Busca candidatos no catálogo via full-text ─────────────────────────
    const candidatos = await this._buscarCandidatosCatalogo(tenantId, descNorm);
    if (!candidatos.length) {
      return {
        catalogo_id: null, catalogo_nome: null,
        fator_conversao: 1.0, unidade_catalogo: null,
        confianca: 0, precisa_confirmacao: false,
        sugestao_id: null, origem: 'sem_match',
        motivo: 'Nenhum candidato encontrado no catálogo',
      };
    }

    // ── 4. Chamada IA para identificar o melhor match ─────────────────────────
    const iaResult = await this._chamarIa(
      tenantId, descricaoOrig, unidadeOrig, candidatos,
    );

    if (!iaResult || iaResult.catalogo_id === null) {
      return {
        catalogo_id: null, catalogo_nome: null,
        fator_conversao: 1.0, unidade_catalogo: null,
        confianca: iaResult?.confianca ?? 0,
        precisa_confirmacao: false,
        sugestao_id: null, origem: 'sem_match',
        motivo: iaResult?.motivo ?? 'IA não encontrou correspondência adequada',
      };
    }

    // ── 5. Salva sugestão para o almoxarife confirmar ─────────────────────────
    const candidatoSelecionado = candidatos.find((c) => c.id === iaResult.catalogo_id);
    const sugestaoId = await this._salvarSugestao(
      tenantId, descricaoOrig, unidadeOrig,
      iaResult.catalogo_id, iaResult.fator_conversao ?? 1.0,
      iaResult.confianca,
      iaResult.motivo,
      iaResult.alternativas ?? null,
      nfeItemId,
    );

    return {
      catalogo_id: iaResult.catalogo_id,
      catalogo_nome: candidatoSelecionado?.nome ?? null,
      fator_conversao: iaResult.fator_conversao ?? 1.0,
      unidade_catalogo: candidatoSelecionado?.unidade ?? null,
      confianca: iaResult.confianca,
      precisa_confirmacao: true,
      sugestao_id: sugestaoId,
      origem: 'ia',
      motivo: iaResult.motivo,
    };
  }

  // ── Confirmar sugestão: cria variante e resolve sugestão ──────────────────────

  async confirmarSugestao(
    sugestaoId: number,
    tenantId: number,
    usuarioId: number,
    ajustes?: { catalogo_id?: number; fator_conversao?: number; marca?: string },
  ): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<{
      id: number; tenant_id: number; descricao_orig: string; unidade_orig: string | null;
      catalogo_id_sug: number; fator_sug: number;
    }[]>(
      `SELECT * FROM alm_catalogo_sugestoes_ia WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'`,
      sugestaoId, tenantId,
    );
    if (!rows.length) throw new Error(`Sugestão ${sugestaoId} não encontrada ou já processada`);

    const s = rows[0];
    const catalogoId = ajustes?.catalogo_id ?? s.catalogo_id_sug;
    const fator = ajustes?.fator_conversao ?? s.fator_sug;

    // Cria a variante confirmada
    const variante = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO alm_catalogo_variantes
         (tenant_id, catalogo_id, descricao_orig, unidade_orig, fator_conversao,
          marca, origem, ia_confianca, confirmado_por, confirmado_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'ia', $7, $8, NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      tenantId, catalogoId, s.descricao_orig, s.unidade_orig, fator,
      ajustes?.marca ?? null, null, usuarioId,
    );

    // Marca sugestão como aprovada
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_catalogo_sugestoes_ia
       SET status = 'aprovado', revisado_por = $1, revisado_at = NOW(),
           variante_criada_id = $2, updated_at = NOW()
       WHERE id = $3`,
      usuarioId, variante[0]?.id ?? null, sugestaoId,
    );

    this.logger.log(JSON.stringify({
      action: 'catalogo.variante.criada', tenantId, catalogoId,
      descricaoOrig: s.descricao_orig, confirmedBy: usuarioId,
    }));

    return variante[0]?.id ?? 0;
  }

  // ── Rejeitar sugestão ─────────────────────────────────────────────────────────

  async rejeitarSugestao(sugestaoId: number, tenantId: number, usuarioId: number): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_catalogo_sugestoes_ia
       SET status = 'rejeitado', revisado_por = $1, revisado_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      usuarioId, sugestaoId, tenantId,
    );
  }

  // ── Listar sugestões pendentes ────────────────────────────────────────────────

  async listarSugestoesPendentes(tenantId: number, limit = 50, offset = 0) {
    return this.prisma.$queryRawUnsafe(
      `SELECT s.*, m.nome AS catalogo_nome, m.unidade AS catalogo_unidade
       FROM alm_catalogo_sugestoes_ia s
       LEFT JOIN fvm_catalogo_materiais m ON m.id = s.catalogo_id_sug
       WHERE s.tenant_id = $1 AND s.status = 'pendente'
       ORDER BY s.confianca DESC, s.created_at ASC
       LIMIT $2 OFFSET $3`,
      tenantId, limit, offset,
    );
  }

  // ── Helpers privados ──────────────────────────────────────────────────────────

  private async _buscarVarianteExata(tenantId: number, descricaoNorm: string) {
    const rows = await this.prisma.$queryRawUnsafe<{
      catalogo_id: number; catalogo_nome: string; fator_conversao: number; unidade: string;
    }[]>(
      `SELECT v.catalogo_id, m.nome AS catalogo_nome, v.fator_conversao, m.unidade
       FROM alm_catalogo_variantes v
       JOIN fvm_catalogo_materiais m ON m.id = v.catalogo_id
       WHERE v.tenant_id = $1
         AND UPPER(TRIM(v.descricao_orig)) = $2
         AND v.ativo = true
         AND v.confirmado_at IS NOT NULL
       LIMIT 1`,
      tenantId, descricaoNorm,
    );
    return rows[0] ?? null;
  }

  private async _buscarVarianteFuzzy(tenantId: number, descricaoNorm: string) {
    const rows = await this.prisma.$queryRawUnsafe<{
      catalogo_id: number; catalogo_nome: string; fator_conversao: number; unidade: string;
      descricao_orig: string; score: number;
    }[]>(
      `SELECT v.catalogo_id, m.nome AS catalogo_nome, v.fator_conversao, m.unidade,
              v.descricao_orig,
              similarity(UPPER(v.descricao_orig), $2) AS score
       FROM alm_catalogo_variantes v
       JOIN fvm_catalogo_materiais m ON m.id = v.catalogo_id
       WHERE v.tenant_id = $1
         AND v.ativo = true
         AND v.confirmado_at IS NOT NULL
         AND similarity(UPPER(v.descricao_orig), $2) > 0.5
       ORDER BY score DESC
       LIMIT 1`,
      tenantId, descricaoNorm,
    ).catch(() => [] as any[]); // pg_trgm pode não estar instalado
    return rows[0] ?? null;
  }

  private async _buscarCandidatosCatalogo(
    tenantId: number,
    descricaoNorm: string,
  ): Promise<CandidatosCatalogo[]> {
    // Extrai tokens relevantes (remove palavras de parada)
    const tokens = descricaoNorm
      .split(/\s+/)
      .filter((t) => t.length > 3)
      .slice(0, 5)
      .join(' & ');

    const rows = await this.prisma.$queryRawUnsafe<CandidatosCatalogo[]>(
      `SELECT m.id, m.nome, m.codigo, m.sinapi_codigo, m.unidade
       FROM fvm_catalogo_materiais m
       WHERE m.tenant_id = $1 AND m.ativo = true
         AND (
           to_tsvector('portuguese', m.nome) @@ plainto_tsquery('portuguese', $2)
           OR UPPER(m.nome) ILIKE $3
         )
       LIMIT 20`,
      tenantId, tokens, `%${descricaoNorm.slice(0, 30)}%`,
    );

    return rows;
  }

  private async _chamarIa(
    tenantId: number,
    descricaoOrig: string,
    unidadeOrig: string | null,
    candidatos: CandidatosCatalogo[],
  ): Promise<{
    catalogo_id: number | null;
    fator_conversao: number;
    confianca: number;
    motivo: string;
    alternativas?: { catalogo_id: number; score: number; motivo: string }[];
  } | null> {
    const catalogoStr = candidatos
      .map((c) => `  {"id":${c.id},"nome":${JSON.stringify(c.nome)},"un":"${c.unidade}"${c.sinapi_codigo ? `,"sinapi":"${c.sinapi_codigo}"` : ''}}`)
      .join('\n');

    const system = `Você é um especialista em almoxarifado de construção civil.
Sua tarefa é identificar a qual item do catálogo interno corresponde um produto descrito em uma Nota Fiscal.

O mesmo produto pode ter NOMES DIFERENTES dependendo do fornecedor ou da marca.
Exemplos:
- "TINTA LATEX PVA BRANCA SUVINIL 3,6L" → catálogo: "TINTA LÁTEX PVA BRANCA 3,6L" ✓
- "CIMENTO PORTLAND CP-II-E-32 VOTORANTIM 50KG" → catálogo: "CIMENTO PORTLAND CP-II 50KG" ✓
- "CX C/ 12 UN PARAFUSO SEXT 1/2x3" → catálogo: "PARAFUSO SEXTAVADO 1/2x3" — fator=12 (cx→un) ✓

Regras:
- Retorne APENAS JSON válido, sem texto extra
- confianca: 0-100 (>= 85 = seguro; 60-84 = revisar; < 60 = sem match)
- fator_conversao: multiplica unidade_orig para obter unidade do catálogo (ex: CX de 12 → fator=12)
- Se nenhum candidato for adequado (confianca < 60), retorne catalogo_id: null`;

    const userMsg = `PRODUTO DA NOTA FISCAL:
  descrição: ${JSON.stringify(descricaoOrig)}
  unidade: ${JSON.stringify(unidadeOrig ?? 'não informada')}

CANDIDATOS DO CATÁLOGO:
${catalogoStr}

Retorne:
{
  "catalogo_id": <id ou null>,
  "fator_conversao": <número>,
  "confianca": <0-100>,
  "motivo": "<explicação curta>",
  "alternativas": [{"catalogo_id": <id>, "score": <0-100>, "motivo": "..."}]
}`;

    const inicio = Date.now();
    try {
      const resp = await this.ia.callClaudeForAgent(
        'claude-haiku-4-5-20251001',
        system, userMsg,
        512, tenantId, SISTEMA_USUARIO_ID, 'alm.catalogo-match',
      );
      const clean = resp.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(clean);

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO alm_ai_analises (tenant_id, tipo, referencia_id, resultado, modelo, duracao_ms)
         VALUES ($1, 'catalogo_match', 0, $2::jsonb, 'claude-haiku-4-5-20251001', $3)`,
        tenantId,
        JSON.stringify({ descricaoOrig, resultado: parsed }),
        Date.now() - inicio,
      );

      return parsed;
    } catch (err: any) {
      this.logger.error(`Erro IA catalogo-match: ${err.message}`);
      return null;
    }
  }

  private async _salvarSugestao(
    tenantId: number,
    descricaoOrig: string,
    unidadeOrig: string | null,
    catalogoId: number,
    fator: number,
    confianca: number,
    motivo: string,
    alternativas: unknown[] | null,
    nfeItemId: number | null,
  ): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO alm_catalogo_sugestoes_ia
         (tenant_id, descricao_orig, unidade_orig, catalogo_id_sug, fator_sug,
          confianca, motivo_ia, alternativas, nfe_item_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING id`,
      tenantId, descricaoOrig, unidadeOrig, catalogoId, fator,
      confianca, motivo, alternativas ? JSON.stringify(alternativas) : null,
      nfeItemId,
    );
    return rows[0]?.id ?? 0;
  }
}
