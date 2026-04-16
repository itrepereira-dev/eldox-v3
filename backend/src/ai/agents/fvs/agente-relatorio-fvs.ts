// backend/src/ai/agents/fvs/agente-relatorio-fvs.ts
// AGENTE-RELATORIO-FVS — gera narrativa semanal de qualidade da obra
// Disparo: cron semanal (segunda-feira 6h) via BullMQ
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';

export interface AgenteRelatorioFvsCtx {
  tenant_id: number;
  usuario_id: number;
  obra_id: number;
  obra_nome: string;
  semana_inicio: string; // ISO date
  semana_fim: string;
}

export interface RelatorioFvsResult {
  narrativa: string;
  taxa_conformidade_geral: number;  // 0–100
  servicos_criticos: string[];
  recomendacoes: string[];
  fonte: 'ia' | 'fallback';
}

const SISTEMA = `Você é um gerente de qualidade especialista em obras (PBQP-H, ISO 9001:2015).
Elabore um relatório semanal de qualidade com base nos dados fornecidos.
Retorne JSON:
{
  "narrativa": "<2-4 parágrafos descrevendo o desempenho de qualidade da semana>",
  "taxa_conformidade_geral": <0-100>,
  "servicos_criticos": ["<serviço 1>", "<serviço 2>"],
  "recomendacoes": ["<ação 1>", "<ação 2>", "<ação 3>"]
}
Seja objetivo, técnico e orientado a ação. Responda SOMENTE o JSON, sem markdown.`;

@Injectable()
export class AgenteRelatorioFvs {
  private readonly logger = new Logger(AgenteRelatorioFvs.name);
  private readonly MODELO = 'claude-sonnet-4-6';
  private readonly MAX_TOKENS = 2000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgenteRelatorioFvsCtx): Promise<RelatorioFvsResult> {
    try {
      const dados = await this.carregarDados(ctx);

      const userMsg = `Obra: ${ctx.obra_nome}
Período: ${ctx.semana_inicio} a ${ctx.semana_fim}
Resumo da semana:
${JSON.stringify(dados, null, 2)}`;

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO, SISTEMA, userMsg, this.MAX_TOKENS,
        ctx.tenant_id, ctx.usuario_id, 'fvs.relatorio_semanal',
      );

      return { ...this.parse(texto), fonte: 'ia' };
    } catch (err) {
      this.logger.warn(`AGENTE-RELATORIO-FVS fallback (tenant=${ctx.tenant_id}): ${(err as Error).message}`);
      return this.fallback();
    }
  }

  private async carregarDados(ctx: AgenteRelatorioFvsCtx) {
    const [fichas, ncs, totalRegistros] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ status: string; total: number }>>(
        `SELECT status, COUNT(*)::int AS total FROM fvs_fichas
         WHERE obra_id = $1 AND tenant_id = $2
           AND (updated_at >= $3::date OR created_at >= $3::date)
         GROUP BY status`,
        ctx.obra_id, ctx.tenant_id, ctx.semana_inicio,
      ),
      this.prisma.$queryRawUnsafe<Array<{ criticidade: string; status: string; total: number; servico_nome: string }>>(
        `SELECT nc.criticidade, nc.status, COUNT(nc.id)::int AS total, cs.nome AS servico_nome
         FROM fvs_nao_conformidades nc
         JOIN fvs_registros r ON r.id = nc.registro_id
         JOIN fvs_ficha_servicos fs ON fs.id = r.ficha_servico_id
         JOIN catalogo_servicos cs ON cs.id = fs.catalogo_servico_id
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1 AND nc.tenant_id = $2
           AND nc.criado_em >= $3::date
         GROUP BY nc.criticidade, nc.status, cs.nome
         ORDER BY total DESC
         LIMIT 20`,
        ctx.obra_id, ctx.tenant_id, ctx.semana_inicio,
      ),
      this.prisma.$queryRawUnsafe<Array<{ status: string; total: number }>>(
        `SELECT r.status, COUNT(r.id)::int AS total
         FROM fvs_registros r
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1 AND r.tenant_id = $2
           AND r.inspecionado_em >= $3::date
         GROUP BY r.status`,
        ctx.obra_id, ctx.tenant_id, ctx.semana_inicio,
      ),
    ]);

    const conformes = totalRegistros.filter(r => ['conforme','conforme_apos_reinspecao','liberado_com_concessao'].includes(r.status)).reduce((s, r) => s + r.total, 0);
    const total = totalRegistros.reduce((s, r) => s + r.total, 0);

    return { fichas, ncs, taxa_conformidade: total ? Math.round((conformes / total) * 100) : null };
  }

  private parse(texto: string): Omit<RelatorioFvsResult, 'fonte'> {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const p = JSON.parse(clean);
    return {
      narrativa: String(p.narrativa ?? ''),
      taxa_conformidade_geral: Math.max(0, Math.min(100, Number(p.taxa_conformidade_geral) || 0)),
      servicos_criticos: Array.isArray(p.servicos_criticos) ? p.servicos_criticos.map(String) : [],
      recomendacoes: Array.isArray(p.recomendacoes) ? p.recomendacoes.map(String) : [],
    };
  }

  private fallback(): RelatorioFvsResult {
    return { narrativa: 'Relatório IA indisponível.', taxa_conformidade_geral: 0, servicos_criticos: [], recomendacoes: [], fonte: 'fallback' };
  }
}
