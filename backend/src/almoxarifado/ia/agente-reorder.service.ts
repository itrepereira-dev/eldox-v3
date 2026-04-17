// backend/src/almoxarifado/ia/agente-reorder.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IaService } from '../../ia/ia.service';
import type {
  AlmReorderPrediction,
  AlmInsightsResult,
} from '../types/alm.types';

const SISTEMA_USUARIO_ID = 1;
const DIAS_HISTORICO = 30;
const DIAS_ALERTA_ATENCAO = 14;
const DIAS_ALERTA_CRITICO = 7;

interface SaldoComConsumo {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  quantidade_atual: number;
  consumo_total_30d: number;
}

@Injectable()
export class AgenteReorderService {
  private readonly logger = new Logger(AgenteReorderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
  ) {}

  /**
   * Analisa o histórico de consumo de uma obra e retorna previsões de reposição.
   * Cria alertas na tabela alm_alertas_estoque para itens críticos/atenção.
   */
  async executar(
    tenantId: number,
    obraId: number,
  ): Promise<AlmReorderPrediction[]> {
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - DIAS_HISTORICO);

    // Busca saldo atual + consumo dos últimos 30 dias (saidas + perdas)
    const saldos = await this.prisma.$queryRawUnsafe<SaldoComConsumo[]>(
      `SELECT
         s.catalogo_id,
         m.nome          AS catalogo_nome,
         s.unidade,
         s.quantidade    AS quantidade_atual,
         COALESCE(SUM(mv.quantidade), 0) AS consumo_total_30d
       FROM alm_estoque_saldo s
       JOIN fvm_catalogo_materiais m ON m.id = s.catalogo_id
       LEFT JOIN alm_movimentos mv
         ON mv.catalogo_id = s.catalogo_id
        AND mv.obra_id     = s.obra_id
        AND mv.tenant_id   = s.tenant_id
        AND mv.tipo IN ('saida', 'perda')
        AND mv.created_at >= $3
       WHERE s.tenant_id = $1
         AND s.obra_id   = $2
         AND s.quantidade > 0
       GROUP BY s.catalogo_id, m.nome, s.unidade, s.quantidade`,
      tenantId,
      obraId,
      dataCorte,
    );

    if (!saldos.length) return [];

    // Filtra apenas itens com consumo > 0 e calcula dias restantes
    const candidatos = saldos
      .filter((s) => Number(s.consumo_total_30d) > 0)
      .map((s) => {
        const consumo_medio_diario =
          Number(s.consumo_total_30d) / DIAS_HISTORICO;
        const quantidade_atual = Number(s.quantidade_atual);
        const dias_restantes =
          consumo_medio_diario > 0
            ? Math.floor(quantidade_atual / consumo_medio_diario)
            : 999;

        return {
          catalogo_id: s.catalogo_id,
          catalogo_nome: s.catalogo_nome,
          unidade: s.unidade,
          quantidade_atual,
          consumo_medio_diario,
          dias_restantes,
        };
      })
      .filter((c) => c.dias_restantes <= DIAS_ALERTA_ATENCAO);

    if (!candidatos.length) return [];

    // Chama IA para análise e recomendação de quantidade de reposição
    const predictions = await this._analisarComIA(candidatos, tenantId, obraId);

    // Persiste alertas
    await this._criarAlertas(predictions, tenantId, obraId);

    return predictions;
  }

  private async _analisarComIA(
    candidatos: {
      catalogo_id: number;
      catalogo_nome: string;
      unidade: string;
      quantidade_atual: number;
      consumo_medio_diario: number;
      dias_restantes: number;
    }[],
    tenantId: number,
    obraId: number,
  ): Promise<AlmReorderPrediction[]> {
    const system = `Você é um especialista em gestão de estoque para obras de construção civil.
Analise os dados de consumo e faça recomendações de reposição de estoque.

Regras:
- Retorne APENAS JSON válido, sem texto extra, sem markdown
- Para cada item, calcule a quantidade recomendada de reposição (para 30 dias de trabalho)
- analise_ia deve ser uma frase curta e objetiva (máx 80 caracteres) explicando o risco
- nivel: "critico" se dias_restantes < 7, "atencao" se < 14`;

    const itensStr = candidatos
      .map((c) =>
        JSON.stringify({
          id: c.catalogo_id,
          material: c.catalogo_nome,
          un: c.unidade,
          estoque_atual: c.quantidade_atual,
          consumo_diario: Number(c.consumo_medio_diario.toFixed(3)),
          dias_restantes: c.dias_restantes,
        }),
      )
      .join('\n');

    const userMessage = `Analise estes materiais em baixo estoque na obra ${obraId}:
${itensStr}

Retorne JSON no formato:
[
  {
    "catalogo_id": <number>,
    "nivel": "critico" | "atencao",
    "recomendacao_qty": <number>,
    "analise_ia": "<string>"
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
        'alm.reorder',
      );
    } catch (err: any) {
      this.logger.error(
        `Erro na chamada IA reorder obra=${obraId}: ${err.message}`,
      );
      // Fallback sem IA: usa regras simples
      return candidatos.map((c) => ({
        ...c,
        local_id: obraId,
        nivel:
          c.dias_restantes < DIAS_ALERTA_CRITICO
            ? ('critico' as const)
            : ('atencao' as const),
        recomendacao_qty: Math.ceil(c.consumo_medio_diario * 30),
        analise_ia: 'Análise automática por regra de estoque mínimo.',
      }));
    }

    const duracaoMs = Date.now() - inicio;

    let iaResults: Array<{
      catalogo_id: number;
      nivel: string;
      recomendacao_qty: number;
      analise_ia: string;
    }>;
    try {
      const clean = responseText.replace(/```json\n?|\n?```/g, '').trim();
      iaResults = JSON.parse(clean);
    } catch {
      this.logger.error(
        `Resposta IA inválida para reorder obra=${obraId}: ${responseText.slice(0, 200)}`,
      );
      iaResults = [];
    }

    // Audit trail
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO alm_ai_analises
         (tenant_id, tipo, referencia_id, resultado, modelo, duracao_ms)
       VALUES ($1, 'reorder_prediction', $2, $3::jsonb, 'claude-haiku-4-5-20251001', $4)`,
      tenantId,
      obraId,
      JSON.stringify({ itens: candidatos.length, predictions: iaResults }),
      duracaoMs,
    );

    // Mescla resultado da IA com dados locais
    return candidatos.map((c) => {
      const ia = iaResults.find((r) => r.catalogo_id === c.catalogo_id);
      return {
        catalogo_id: c.catalogo_id,
        catalogo_nome: c.catalogo_nome,
        unidade: c.unidade,
        quantidade_atual: c.quantidade_atual,
        consumo_medio_diario: c.consumo_medio_diario,
        dias_restantes: c.dias_restantes,
        local_id: obraId,
        nivel: (ia?.nivel ??
          (c.dias_restantes < DIAS_ALERTA_CRITICO ? 'critico' : 'atencao')) as
          | 'critico'
          | 'atencao',
        recomendacao_qty:
          ia?.recomendacao_qty ?? Math.ceil(c.consumo_medio_diario * 30),
        analise_ia: ia?.analise_ia ?? 'Material com estoque baixo.',
      };
    });
  }

  private async _criarAlertas(
    predictions: AlmReorderPrediction[],
    tenantId: number,
    obraId: number,
  ): Promise<void> {
    for (const p of predictions) {
      // Upsert: se já existe alerta não lido para este item, atualiza; senão cria
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO alm_alertas_estoque
           (tenant_id, obra_id, catalogo_id, tipo, nivel, mensagem, lido)
         VALUES ($1, $2, $3, 'reposicao_prevista', $4, $5, false)
         ON CONFLICT DO NOTHING`,
        tenantId,
        obraId,
        p.catalogo_id,
        p.nivel,
        `${p.catalogo_nome}: ~${p.dias_restantes} dias restantes. ${p.analise_ia}`,
      );
    }

    this.logger.log(
      JSON.stringify({
        action: 'alm.reorder.alertas_criados',
        obraId,
        tenantId,
        total: predictions.length,
        critico: predictions.filter((p) => p.nivel === 'critico').length,
      }),
    );
  }

  /**
   * Retorna as predições de reposição para exibição no frontend (sem persistir alertas).
   */
  async getInsights(
    tenantId: number,
    obraId: number,
  ): Promise<AlmReorderPrediction[]> {
    return this.executar(tenantId, obraId);
  }
}
