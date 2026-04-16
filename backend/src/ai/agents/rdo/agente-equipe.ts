// /backend/src/ai/agents/rdo/agente-equipe.ts
// AGENTE-EQUIPE — Haiku 4.5
// Handler name: 'rdo.equipe'

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';
import { buildPromptEquipe } from '../../prompts/rdo/equipe.prompt';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AgenteEquipeCtx {
  obra_id: number;
  tenant_id: number;
  usuario_id: number;
  data: string;  // ISO 8601 — data do RDO
}

export interface EquipeSugestao {
  funcao: string;
  quantidade: number;
  confianca: number;
}

export interface AgenteEquipeResult {
  sugestoes: EquipeSugestao[];
  alerta_reducao: boolean;   // true se sugestão >= 20% menor que média 5 dias
  fonte: 'ia' | 'fallback';
  tenant_id: number;
}

// ── Agente ────────────────────────────────────────────────────────────────────

@Injectable()
export class AgenteEquipe {
  private readonly logger = new Logger(AgenteEquipe.name);
  private readonly MODELO = 'claude-haiku-4-5-20251001';
  private readonly MAX_TOKENS = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgenteEquipeCtx): Promise<AgenteEquipeResult> {
    try {
      const { historicoRdos, obraNome, mediaEquipe } = await this.carregarContexto(ctx);

      const diaSemana = new Date(ctx.data).toLocaleDateString('pt-BR', { weekday: 'long' });
      const { system, user } = buildPromptEquipe({
        obra_nome: obraNome,
        dia_semana: diaSemana,
        historico_rdos: JSON.stringify(historicoRdos),
        tenant_id: ctx.tenant_id,
      });

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO,
        system,
        user,
        this.MAX_TOKENS,
        ctx.tenant_id,
        ctx.usuario_id,
        'rdo.equipe',
      );

      const sugestoes = this.parseResposta(texto);
      const alertaReducao = this.verificarReducao(sugestoes, mediaEquipe);

      return { sugestoes, alerta_reducao: alertaReducao, fonte: 'ia', tenant_id: ctx.tenant_id };
    } catch (err) {
      this.logger.warn(
        `AGENTE-EQUIPE fallback ativado (tenant=${ctx.tenant_id}, obra=${ctx.obra_id}): ${(err as Error).message}`,
      );
      return this.fallback(ctx);
    }
  }

  // ── Contexto ────────────────────────────────────────────────────────────────

  private async carregarContexto(ctx: AgenteEquipeCtx) {
    const [obra, rdos] = await Promise.all([
      this.prisma.$queryRaw<Array<{ nome: string }>>`
        SELECT nome FROM "Obra" WHERE id = ${ctx.obra_id} AND tenant_id = ${ctx.tenant_id} LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ data: string; equipe: unknown }>>`
        SELECT data, equipe
        FROM rdos
        WHERE obra_id = ${ctx.obra_id}
          AND tenant_id = ${ctx.tenant_id}
          AND equipe IS NOT NULL
        ORDER BY data DESC
        LIMIT 7
      `,
    ]);

    const obraNome = obra[0]?.nome ?? `Obra #${ctx.obra_id}`;

    // Calcula média de equipe dos últimos 5 dias para detecção de redução
    const ultimos5 = rdos.slice(0, 5);
    const totalPorFuncao: Record<string, number[]> = {};
    for (const rdo of ultimos5) {
      const eq = rdo.equipe as EquipeSugestao[] | null;
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

    return { historicoRdos: rdos, obraNome, mediaEquipe };
  }

  // ── Parse ───────────────────────────────────────────────────────────────────

  private parseResposta(texto: string): EquipeSugestao[] {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(clean) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Resposta não é array');
    return (parsed as EquipeSugestao[]).map((item) => ({
      funcao: String(item.funcao),
      quantidade: Math.max(1, Math.round(Number(item.quantidade))),
      confianca: Math.min(1, Math.max(0, Number(item.confianca))),
    }));
  }

  private verificarReducao(
    sugestoes: EquipeSugestao[],
    media: Record<string, number>,
  ): boolean {
    for (const sug of sugestoes) {
      const mediaFuncao = media[sug.funcao];
      if (mediaFuncao && sug.quantidade < mediaFuncao * 0.8) {
        return true;
      }
    }
    return false;
  }

  // ── Fallback ────────────────────────────────────────────────────────────────

  private async fallback(ctx: AgenteEquipeCtx): Promise<AgenteEquipeResult> {
    try {
      const ultimoRdo = await this.prisma.$queryRaw<Array<{ equipe: unknown }>>`
        SELECT equipe FROM rdos
        WHERE obra_id = ${ctx.obra_id}
          AND tenant_id = ${ctx.tenant_id}
          AND equipe IS NOT NULL
        ORDER BY data DESC
        LIMIT 1
      `;

      const equipe = (ultimoRdo[0]?.equipe as EquipeSugestao[] | null) ?? [];
      const sugestoes = equipe.map((item) => ({ ...item, confianca: 0.5 }));

      return { sugestoes, alerta_reducao: false, fonte: 'fallback', tenant_id: ctx.tenant_id };
    } catch (fallbackErr) {
      this.logger.error(`AGENTE-EQUIPE fallback DB falhou: ${(fallbackErr as Error).message}`);
      return { sugestoes: [], alerta_reducao: false, fonte: 'fallback', tenant_id: ctx.tenant_id };
    }
  }
}
