// backend/src/almoxarifado/nfe/nfe-match.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IaService } from '../../ia/ia.service';
import { AgenteCatalogoService } from '../ia/agente-catalogo.service';
import type { AiSugestaoMatch } from '../types/alm.types';

// ID de sistema para logs de IA sem usuário real
const SISTEMA_USUARIO_ID = 1;

interface CatalogoEntry {
  id: number;
  nome: string;
  codigo: string | null;
  unidade_padrao: string | null;
}

@Injectable()
export class NfeMatchService {
  private readonly logger = new Logger(NfeMatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
    private readonly agenteCatalogo: AgenteCatalogoService,
  ) {}

  /**
   * Executa match IA para todos os itens pendentes de uma NF-e.
   * Usa claude-haiku para velocidade e baixo custo (lote de até 20 itens por chamada).
   */
  async matchItens(nfeId: number, tenantId: number): Promise<void> {
    // Busca itens ainda sem match
    const itens = await this.prisma.$queryRawUnsafe<{
      id: number; xprod: string; unidade_nfe: string | null;
    }[]>(
      `SELECT id, xprod, unidade_nfe
       FROM alm_nfe_itens
       WHERE nfe_id = $1 AND match_status = 'pendente'`,
      nfeId,
    );

    if (!itens.length) return;

    // ── Passo 1: tenta resolver via variantes confirmadas (sem IA) ────────────
    const pendentesParaIa: typeof itens = [];

    for (const item of itens) {
      const match = await this.agenteCatalogo.identificarProduto(
        tenantId, item.xprod, item.unidade_nfe, item.id,
      );

      if (match.origem === 'variante_confirmada') {
        // Match direto — atualiza sem chamar IA
        await this.prisma.$executeRawUnsafe(
          `UPDATE alm_nfe_itens
           SET catalogo_id  = $1,
               match_status = 'auto',
               ai_score     = 1.0,
               ai_sugestoes = $2::jsonb
           WHERE id = $3 AND nfe_id = $4`,
          match.catalogo_id,
          JSON.stringify([{ catalogo_id: match.catalogo_id, score: 1.0, motivo: match.motivo }]),
          item.id, nfeId,
        );
      } else if (match.origem === 'ia' && match.confianca >= 70) {
        // IA já processou, salva sugestão + atualiza item como pendente
        await this.prisma.$executeRawUnsafe(
          `UPDATE alm_nfe_itens
           SET catalogo_id  = $1,
               match_status = 'pendente',
               ai_score     = $2,
               ai_sugestoes = $3::jsonb
           WHERE id = $4 AND nfe_id = $5`,
          match.catalogo_id,
          match.confianca / 100,
          JSON.stringify([{ catalogo_id: match.catalogo_id, score: match.confianca / 100, motivo: match.motivo }]),
          item.id, nfeId,
        );
      } else {
        // Sem match via variantes — envia para o batch de IA clássico
        pendentesParaIa.push(item);
      }
    }

    if (!pendentesParaIa.length) return;

    // ── Passo 2: match IA clássico para os restantes ──────────────────────────
    const catalogo = await this.prisma.$queryRawUnsafe<CatalogoEntry[]>(
      `SELECT m.id, m.nome, m.codigo, m.unidade AS unidade_padrao
       FROM fvm_catalogo_materiais m
       WHERE m.tenant_id = $1 AND m.ativo = true
       ORDER BY m.nome ASC
       LIMIT 200`,
      tenantId,
    );

    if (!catalogo.length) {
      this.logger.warn(`Catálogo vazio para tenant ${tenantId} — match IA abortado`);
      return;
    }

    // Processa em lotes de 20 itens por chamada IA
    const BATCH = 20;
    for (let start = 0; start < pendentesParaIa.length; start += BATCH) {
      const batch = pendentesParaIa.slice(start, start + BATCH);
      await this._matchBatch(batch, catalogo, nfeId, tenantId);
    }
  }

  private async _matchBatch(
    itens:    { id: number; xprod: string; unidade_nfe: string | null }[],
    catalogo: CatalogoEntry[],
    nfeId:    number,
    tenantId: number,
  ): Promise<void> {
    const catalogoStr = catalogo
      .map((c) => `  {"id":${c.id},"nome":${JSON.stringify(c.nome)},"un":${JSON.stringify(c.unidade_padrao ?? '')}${c.codigo ? `,"cod":${JSON.stringify(c.codigo)}` : ''}}`)
      .join('\n');

    const itensStr = itens
      .map((i) => `  {"item_id":${i.id},"xprod":${JSON.stringify(i.xprod)},"un":${JSON.stringify(i.unidade_nfe ?? '')}}`)
      .join('\n');

    const system = `Você é um assistente de almoxarifado especializado em correspondência de materiais de construção.
Sua tarefa é encontrar a melhor correspondência entre itens de Nota Fiscal e itens de um catálogo de materiais.

Regras:
- Retorne APENAS JSON válido, sem texto extra, sem markdown
- Para cada item da NF-e, retorne as TOP 3 sugestões do catálogo ordenadas por score
- Score de 0.0 a 1.0 (1.0 = correspondência exata, 0.0 = sem relação)
- Se score < 0.3 para todas as sugestões, use match_status = "sem_match"
- Se score >= 0.7 para a primeira sugestão, use match_status = "auto"
- Caso contrário, use match_status = "pendente"
- Considere variações de nome, abreviações, sinônimos, unidades equivalentes`;

    const userMessage = `CATÁLOGO (${catalogo.length} itens):
${catalogoStr}

ITENS DA NF-e para classificar:
${itensStr}

Retorne JSON no formato:
[
  {
    "item_id": <number>,
    "match_status": "auto" | "pendente" | "sem_match",
    "melhor_catalogo_id": <number | null>,
    "sugestoes": [
      {"catalogo_id": <number>, "score": <0-1>, "motivo": "<string curto>"},
      ...
    ]
  }
]`;

    const inicio = Date.now();
    let responseText: string;
    try {
      responseText = await this.ia.callClaudeForAgent(
        'claude-haiku-4-5-20251001',
        system,
        userMessage,
        1024,
        tenantId,
        SISTEMA_USUARIO_ID,
        'alm.nfe-match',
      );
    } catch (err: any) {
      this.logger.error(`Erro na chamada IA para match NF-e ${nfeId}: ${err.message}`);
      return;
    }

    let matches: Array<{
      item_id: number;
      match_status: string;
      melhor_catalogo_id: number | null;
      sugestoes: AiSugestaoMatch[];
    }>;

    try {
      // Remove possível markdown wrapper
      const clean = responseText.replace(/```json\n?|\n?```/g, '').trim();
      matches = JSON.parse(clean);
    } catch {
      this.logger.error(`Resposta IA inválida para NF-e ${nfeId}: ${responseText.slice(0, 200)}`);
      return;
    }

    const duracaoMs = Date.now() - inicio;

    for (const m of matches) {
      const sugestoes = (m.sugestoes ?? []).slice(0, 3);

      await this.prisma.$executeRawUnsafe(
        `UPDATE alm_nfe_itens
         SET catalogo_id   = $1,
             match_status  = $2,
             ai_score      = $3,
             ai_sugestoes  = $4::jsonb
         WHERE id = $5 AND nfe_id = $6`,
        m.melhor_catalogo_id ?? null,
        m.match_status,
        sugestoes[0]?.score ?? null,
        JSON.stringify(sugestoes),
        m.item_id, nfeId,
      );
    }

    // Audit trail
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO alm_ai_analises
         (tenant_id, tipo, referencia_id, resultado, modelo, duracao_ms)
       VALUES ($1, 'nfe_match', $2, $3::jsonb, 'claude-haiku-4-5-20251001', $4)`,
      tenantId, nfeId,
      JSON.stringify({ itens_processados: itens.length, matches }),
      duracaoMs,
    );

    this.logger.log(JSON.stringify({
      action: 'alm.nfe.match',
      nfeId, tenantId,
      itens: itens.length,
      auto: matches.filter((m) => m.match_status === 'auto').length,
    }));
  }
}
