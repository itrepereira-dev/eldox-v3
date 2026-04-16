// /backend/src/ai/agents/rdo/agente-atividade.ts
// AGENTE-ATIVIDADE — Haiku 4.5
// Handler name: 'rdo.atividade'

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';
import { buildPromptAtividade } from '../../prompts/rdo/atividade.prompt';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AgenteAtividadeCtx {
  obra_id: number;
  tenant_id: number;
  usuario_id: number;
  equipe_hoje: Array<{ funcao: string; quantidade: number }>;
}

export interface AtividadeSugestao {
  descricao: string;
  etapa_tarefa_id: number | null;
  prioridade: number;
  progresso_pct_sugerido: number;
}

export interface AgenteAtividadeResult {
  sugestoes: AtividadeSugestao[];
  fonte: 'ia' | 'fallback';
  tenant_id: number;
}

// ── Agente ────────────────────────────────────────────────────────────────────

@Injectable()
export class AgenteAtividade {
  private readonly logger = new Logger(AgenteAtividade.name);
  private readonly MODELO = 'claude-haiku-4-5-20251001';
  private readonly MAX_TOKENS = 800;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgenteAtividadeCtx): Promise<AgenteAtividadeResult> {
    try {
      const { obraNome, tarefasAtivas, atividadesUltimosRdos, mediaEquipe } =
        await this.carregarContexto(ctx);

      const { system, user } = buildPromptAtividade({
        obra_nome: obraNome,
        tenant_id: ctx.tenant_id,
        tarefas_ativas: JSON.stringify(tarefasAtivas),
        atividades_ultimos_rdos: JSON.stringify(atividadesUltimosRdos),
        equipe_hoje: JSON.stringify(ctx.equipe_hoje),
        equipe_media: JSON.stringify(mediaEquipe),
      });

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO,
        system,
        user,
        this.MAX_TOKENS,
        ctx.tenant_id,
        ctx.usuario_id,
        'rdo.atividade',
      );

      const sugestoes = this.parseResposta(texto);
      return { sugestoes, fonte: 'ia', tenant_id: ctx.tenant_id };
    } catch (err) {
      this.logger.warn(
        `AGENTE-ATIVIDADE fallback ativado (tenant=${ctx.tenant_id}, obra=${ctx.obra_id}): ${(err as Error).message}`,
      );
      return this.fallback(ctx);
    }
  }

  // ── Contexto ────────────────────────────────────────────────────────────────

  private async carregarContexto(ctx: AgenteAtividadeCtx) {
    const [obra, tarefas, rdosRecentes] = await Promise.all([
      this.prisma.$queryRaw<Array<{ nome: string }>>`
        SELECT nome FROM "Obra" WHERE id = ${ctx.obra_id} AND tenant_id = ${ctx.tenant_id} LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ id: number; descricao: string; status: string; progresso_pct: number; caminho_critico: boolean; etapa: string }>>`
        SELECT id, descricao, status, progresso_pct, caminho_critico, etapa
        FROM etapas_tarefas
        WHERE obra_id = ${ctx.obra_id}
          AND tenant_id = ${ctx.tenant_id}
          AND status NOT IN ('concluida', 'cancelada')
        ORDER BY caminho_critico DESC, progresso_pct ASC
        LIMIT 20
      `,
      this.prisma.$queryRaw<Array<{ atividades: unknown; equipe: unknown }>>`
        SELECT atividades, equipe
        FROM rdos
        WHERE obra_id = ${ctx.obra_id}
          AND tenant_id = ${ctx.tenant_id}
          AND atividades IS NOT NULL
        ORDER BY data DESC
        LIMIT 3
      `,
    ]);

    // Calcula média da equipe dos últimos 5 RDOs
    const ultimos5Rdos = await this.prisma.$queryRaw<Array<{ equipe: unknown }>>`
      SELECT equipe FROM rdos
      WHERE obra_id = ${ctx.obra_id}
        AND tenant_id = ${ctx.tenant_id}
        AND equipe IS NOT NULL
      ORDER BY data DESC
      LIMIT 5
    `;

    const totalPorFuncao: Record<string, number[]> = {};
    for (const rdo of ultimos5Rdos) {
      const eq = rdo.equipe as Array<{ funcao: string; quantidade: number }> | null;
      if (!eq) continue;
      for (const item of eq) {
        if (!totalPorFuncao[item.funcao]) totalPorFuncao[item.funcao] = [];
        totalPorFuncao[item.funcao].push(item.quantidade);
      }
    }
    const mediaEquipe: Record<string, number> = {};
    for (const [funcao, qtds] of Object.entries(totalPorFuncao)) {
      mediaEquipe[funcao] = qtds.reduce((a, b) => a + b, 0) / qtds.length;
    }

    return {
      obraNome: obra[0]?.nome ?? `Obra #${ctx.obra_id}`,
      tarefasAtivas: tarefas,
      atividadesUltimosRdos: rdosRecentes.map((r) => r.atividades),
      mediaEquipe,
    };
  }

  // ── Parse ───────────────────────────────────────────────────────────────────

  private parseResposta(texto: string): AtividadeSugestao[] {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(clean) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Resposta não é array');
    return (parsed as AtividadeSugestao[]).map((item, i) => ({
      descricao: String(item.descricao),
      etapa_tarefa_id: item.etapa_tarefa_id != null ? Number(item.etapa_tarefa_id) : null,
      prioridade: Math.max(1, Math.round(Number(item.prioridade ?? i + 1))),
      progresso_pct_sugerido: Math.min(100, Math.max(0, Math.round(Number(item.progresso_pct_sugerido ?? 0)))),
    }));
  }

  // ── Fallback ────────────────────────────────────────────────────────────────

  private async fallback(ctx: AgenteAtividadeCtx): Promise<AgenteAtividadeResult> {
    try {
      const ultimoRdo = await this.prisma.$queryRaw<Array<{ atividades: unknown }>>`
        SELECT atividades FROM rdos
        WHERE obra_id = ${ctx.obra_id}
          AND tenant_id = ${ctx.tenant_id}
          AND atividades IS NOT NULL
        ORDER BY data DESC
        LIMIT 1
      `;

      const atividades = (ultimoRdo[0]?.atividades as AtividadeSugestao[] | null) ?? [];
      return { sugestoes: atividades, fonte: 'fallback', tenant_id: ctx.tenant_id };
    } catch (fallbackErr) {
      this.logger.error(`AGENTE-ATIVIDADE fallback DB falhou: ${(fallbackErr as Error).message}`);
      return { sugestoes: [], fonte: 'fallback', tenant_id: ctx.tenant_id };
    }
  }
}
