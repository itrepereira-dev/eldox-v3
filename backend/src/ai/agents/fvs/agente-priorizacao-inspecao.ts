// backend/src/ai/agents/fvs/agente-priorizacao-inspecao.ts
// AGENTE-PRIORIZACAO — ordena fila de inspeção do dia por risco e histórico
// Disparo: cron diário 5h45 via BullMQ, ou sob demanda
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';

export interface AgentePriorizacaoCtx {
  tenant_id: number;
  usuario_id: number;
  obra_id: number;
}

export interface PriorizacaoItem {
  ficha_id: number;
  ficha_titulo: string;
  prioridade: number;   // 1 = mais urgente
  motivo: string;
}

export interface PriorizacaoResult {
  fila: PriorizacaoItem[];
  fonte: 'ia' | 'fallback';
}

const SISTEMA = `Você é um coordenador de qualidade de obra.
Dado o estado das fichas de inspeção, ordene por prioridade de execução hoje.
Retorne JSON:
{
  "fila": [
    { "ficha_id": <int>, "ficha_titulo": "<string>", "prioridade": <1..N>, "motivo": "<frase curta>" }
  ]
}
Critérios: NCs abertas críticas > prazo de entrega > risco histórico > quantidade de itens pendentes.
Responda SOMENTE o JSON, sem markdown.`;

@Injectable()
export class AgentePriorizacaoInspecao {
  private readonly logger = new Logger(AgentePriorizacaoInspecao.name);
  private readonly MODELO = 'claude-haiku-4-5-20251001';
  private readonly MAX_TOKENS = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgentePriorizacaoCtx): Promise<PriorizacaoResult> {
    try {
      const fichas = await this.carregarFichas(ctx);
      if (!fichas.length) return { fila: [], fonte: 'ia' };

      const userMsg = `Obra ID: ${ctx.obra_id}
Fichas pendentes: ${JSON.stringify(fichas, null, 2)}`;

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO, SISTEMA, userMsg, this.MAX_TOKENS,
        ctx.tenant_id, ctx.usuario_id, 'fvs.priorizacao',
      );

      return { ...this.parse(texto), fonte: 'ia' };
    } catch (err) {
      this.logger.warn(`AGENTE-PRIORIZACAO fallback (tenant=${ctx.tenant_id}): ${(err as Error).message}`);
      return this.fallback();
    }
  }

  private async carregarFichas(ctx: AgentePriorizacaoCtx) {
    return this.prisma.$queryRawUnsafe<Array<{
      ficha_id: number; titulo: string; status: string;
      ncs_abertas: number; risco_score: number | null;
      itens_pendentes: number;
    }>>(
      `SELECT
         f.id AS ficha_id,
         f.titulo,
         f.status,
         f.risco_score,
         COUNT(DISTINCT nc.id) FILTER (WHERE nc.status = 'aberta')::int AS ncs_abertas,
         COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'nao_avaliado')::int AS itens_pendentes
       FROM fvs_fichas f
       LEFT JOIN fvs_registros r ON r.ficha_id = f.id
       LEFT JOIN fvs_nao_conformidades nc ON nc.registro_id = r.id AND nc.tenant_id = $2
       WHERE f.obra_id = $1 AND f.tenant_id = $2
         AND f.status IN ('rascunho', 'em_inspecao')
         AND f.deleted_at IS NULL
       GROUP BY f.id, f.titulo, f.status, f.risco_score
       LIMIT 30`,
      ctx.obra_id, ctx.tenant_id,
    );
  }

  private parse(texto: string): Omit<PriorizacaoResult, 'fonte'> {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const p = JSON.parse(clean);
    const fila = (p.fila ?? []).map((item: any, idx: number) => ({
      ficha_id: Number(item.ficha_id),
      ficha_titulo: String(item.ficha_titulo ?? ''),
      prioridade: Number(item.prioridade ?? idx + 1),
      motivo: String(item.motivo ?? ''),
    }));
    return { fila };
  }

  private fallback(): PriorizacaoResult {
    return { fila: [], fonte: 'fallback' };
  }
}
