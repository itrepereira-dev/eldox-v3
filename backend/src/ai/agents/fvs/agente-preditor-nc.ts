// backend/src/ai/agents/fvs/agente-preditor-nc.ts
// AGENTE-PREDITOR-NC — calcula risco de NC por célula da grade (serviço × local)
// Roda via cron diário ou sob demanda ao abrir ficha
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';

export interface AgentePreditorNcCtx {
  tenant_id: number;
  usuario_id: number;
  ficha_id: number;
  obra_id: number;
}

export interface PreditorNcResult {
  scores: Array<{
    servico_id: number;
    local_id: number;
    risco: number;  // 0–100
    motivo: string;
  }>;
  fonte: 'ia' | 'fallback';
}

const SISTEMA = `Você é um sistema de predição de risco de não conformidades em inspeções de obra.
Dado o histórico de NCs e os serviços a inspecionar, retorne JSON:
{
  "scores": [
    { "servico_id": <int>, "local_id": <int>, "risco": <0-100>, "motivo": "<frase curta>" }
  ]
}
Risco 0 = sem histórico de problemas. Risco 100 = sempre tem NC.
Responda SOMENTE o JSON, sem markdown.`;

@Injectable()
export class AgentePreditorNc {
  private readonly logger = new Logger(AgentePreditorNc.name);
  private readonly MODELO = 'claude-haiku-4-5-20251001';
  private readonly MAX_TOKENS = 1500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgentePreditorNcCtx): Promise<PreditorNcResult> {
    try {
      const contexto = await this.carregarContexto(ctx);
      if (!contexto.servicos.length) return { scores: [], fonte: 'ia' };

      const userMsg = `Ficha: ${ctx.ficha_id}, Obra: ${ctx.obra_id}
Serviços a inspecionar: ${JSON.stringify(contexto.servicos)}
Histórico de NCs da obra (últimos 90 dias): ${JSON.stringify(contexto.historico)}`;

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO, SISTEMA, userMsg, this.MAX_TOKENS,
        ctx.tenant_id, ctx.usuario_id, 'fvs.preditor_nc',
      );

      const result = this.parse(texto);

      // Atualiza risco_score na ficha como média geral
      if (result.scores.length) {
        const media = Math.round(result.scores.reduce((s, r) => s + r.risco, 0) / result.scores.length);
        await this.prisma.$executeRawUnsafe(
          `UPDATE fvs_fichas SET risco_score = $1 WHERE id = $2 AND tenant_id = $3`,
          media, ctx.ficha_id, ctx.tenant_id,
        );
      }

      return { ...result, fonte: 'ia' };
    } catch (err) {
      this.logger.warn(`AGENTE-PREDITOR-NC fallback (tenant=${ctx.tenant_id}): ${(err as Error).message}`);
      return { scores: [], fonte: 'fallback' };
    }
  }

  private async carregarContexto(ctx: AgentePreditorNcCtx) {
    const [servicos, historico] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ servico_id: number; local_id: number; servico_nome: string; local_nome: string }>>(
        `SELECT fs.id AS servico_id, fl.id AS local_id,
                cs.nome AS servico_nome, fl.nome AS local_nome
         FROM fvs_ficha_servicos fs
         JOIN fvs_ficha_locais fl ON fl.ficha_id = fs.ficha_id
         JOIN catalogo_servicos cs ON cs.id = fs.catalogo_servico_id
         WHERE fs.ficha_id = $1 AND fs.tenant_id = $2
         LIMIT 100`,
        ctx.ficha_id, ctx.tenant_id,
      ),
      this.prisma.$queryRawUnsafe<Array<{ servico_nome: string; total_ncs: number; criticidade: string }>>(
        `SELECT cs.nome AS servico_nome, COUNT(nc.id)::int AS total_ncs, nc.criticidade
         FROM fvs_nao_conformidades nc
         JOIN fvs_registros r ON r.id = nc.registro_id
         JOIN fvs_ficha_servicos fs ON fs.id = r.ficha_servico_id
         JOIN catalogo_servicos cs ON cs.id = fs.catalogo_servico_id
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1 AND nc.tenant_id = $2
           AND nc.criado_em > NOW() - INTERVAL '90 days'
         GROUP BY cs.nome, nc.criticidade
         LIMIT 50`,
        ctx.obra_id, ctx.tenant_id,
      ),
    ]);
    return { servicos, historico };
  }

  private parse(texto: string): Omit<PreditorNcResult, 'fonte'> {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const p = JSON.parse(clean);
    const scores = (p.scores ?? []).map((s: any) => ({
      servico_id: Number(s.servico_id),
      local_id: Number(s.local_id),
      risco: Math.max(0, Math.min(100, Number(s.risco) || 0)),
      motivo: String(s.motivo ?? ''),
    }));
    return { scores };
  }
}
