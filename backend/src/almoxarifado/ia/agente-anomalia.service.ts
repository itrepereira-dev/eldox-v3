// backend/src/almoxarifado/ia/agente-anomalia.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IaService } from '../../ia/ia.service';
import type { AlmAnomaliaDetectada } from '../types/alm.types';

const SISTEMA_USUARIO_ID = 1;
// Desvio >= 2x a média dos últimos 30d nos últimos 7d = anomalia
const FATOR_ANOMALIA_ATENCAO = 2.0;
const FATOR_ANOMALIA_CRITICO = 3.5;

interface ConsumoItem {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  consumo_7d: number;
  consumo_30d: number;
}

@Injectable()
export class AgenteAnomaliaService {
  private readonly logger = new Logger(AgenteAnomaliaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
  ) {}

  /**
   * Detecta consumo anômalo comparando os últimos 7 dias com a média dos últimos 30 dias.
   * Itens com fator de desvio >= FATOR_ANOMALIA_ATENCAO são analisados por IA.
   */
  async executar(tenantId: number, obraId: number): Promise<AlmAnomaliaDetectada[]> {
    const agora = new Date();
    const data7d  = new Date(agora); data7d.setDate(agora.getDate() - 7);
    const data30d = new Date(agora); data30d.setDate(agora.getDate() - 30);

    const consumos = await this.prisma.$queryRawUnsafe<ConsumoItem[]>(
      `SELECT
         m.id   AS catalogo_id,
         m.nome AS catalogo_nome,
         s.unidade,
         COALESCE(SUM(CASE WHEN mv.created_at >= $3 THEN mv.quantidade ELSE 0 END), 0) AS consumo_7d,
         COALESCE(SUM(CASE WHEN mv.created_at >= $4 THEN mv.quantidade ELSE 0 END), 0) AS consumo_30d
       FROM alm_estoque_saldo s
       JOIN fvm_catalogo_materiais m ON m.id = s.catalogo_id
       LEFT JOIN alm_movimentos mv
         ON mv.catalogo_id = s.catalogo_id
        AND mv.obra_id     = s.obra_id
        AND mv.tenant_id   = s.tenant_id
        AND mv.tipo IN ('saida', 'perda')
        AND mv.created_at >= $4
       WHERE s.tenant_id = $1
         AND s.obra_id   = $2
       GROUP BY m.id, m.nome, s.unidade
       HAVING COALESCE(SUM(CASE WHEN mv.created_at >= $4 THEN mv.quantidade ELSE 0 END), 0) > 0`,
      tenantId, obraId, data7d, data30d,
    );

    if (!consumos.length) return [];

    // Filtra anomalias: normaliza consumo_7d para base diária e compara com média diária 30d
    const anomalias = consumos
      .map((c) => {
        const consumo_7d   = Number(c.consumo_7d);
        const consumo_30d  = Number(c.consumo_30d);
        // média diária dos últimos 30d (excluindo os 7d para não inflar com a própria anomalia)
        const media_diaria_30d = consumo_30d / 30;
        const consumo_diario_7d = consumo_7d / 7;
        const fator_desvio = media_diaria_30d > 0
          ? consumo_diario_7d / media_diaria_30d
          : 0;

        return {
          catalogo_id:       c.catalogo_id,
          catalogo_nome:     c.catalogo_nome,
          unidade:           c.unidade,
          consumo_recente_7d: consumo_7d,
          consumo_medio_30d:  consumo_30d,
          fator_desvio,
        };
      })
      .filter((a) => a.fator_desvio >= FATOR_ANOMALIA_ATENCAO);

    if (!anomalias.length) return [];

    return this._analisarComIA(anomalias, tenantId, obraId);
  }

  private async _analisarComIA(
    anomalias: {
      catalogo_id: number;
      catalogo_nome: string;
      unidade: string;
      consumo_recente_7d: number;
      consumo_medio_30d: number;
      fator_desvio: number;
    }[],
    tenantId: number,
    obraId: number,
  ): Promise<AlmAnomaliaDetectada[]> {
    const system = `Você é um especialista em gestão de estoque para obras de construção civil.
Analise padrões de consumo anômalo e identifique possíveis causas.

Regras:
- Retorne APENAS JSON válido, sem texto extra, sem markdown
- explicacao_ia deve ser uma frase curta (máx 100 caracteres) com a causa mais provável
- nivel: "critico" se fator_desvio >= 3.5, "atencao" se >= 2.0
- Causas comuns: frente de trabalho nova, desperdício, furto, lançamento duplicado, pico de serviço`;

    const itensStr = anomalias
      .map((a) => JSON.stringify({
        id:              a.catalogo_id,
        material:        a.catalogo_nome,
        un:              a.unidade,
        consumo_7d:      Number(a.consumo_recente_7d.toFixed(2)),
        consumo_30d:     Number(a.consumo_medio_30d.toFixed(2)),
        fator_desvio:    Number(a.fator_desvio.toFixed(2)),
      }))
      .join('\n');

    const userMessage = `Analise estas anomalias de consumo detectadas na obra ${obraId}:
${itensStr}

Retorne JSON no formato:
[
  {
    "catalogo_id": <number>,
    "nivel": "critico" | "atencao",
    "explicacao_ia": "<string>"
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
        'alm.anomalia',
      );
    } catch (err: any) {
      this.logger.error(`Erro na chamada IA anomalia obra=${obraId}: ${err.message}`);
      return anomalias.map((a) => ({
        ...a,
        obra_id:       obraId,
        nivel:         a.fator_desvio >= FATOR_ANOMALIA_CRITICO ? 'critico' as const : 'atencao' as const,
        explicacao_ia: `Consumo ${a.fator_desvio.toFixed(1)}x acima da média dos últimos 30 dias.`,
      }));
    }

    const duracaoMs = Date.now() - inicio;

    let iaResults: Array<{ catalogo_id: number; nivel: string; explicacao_ia: string }>;
    try {
      const clean = responseText.replace(/```json\n?|\n?```/g, '').trim();
      iaResults = JSON.parse(clean);
    } catch {
      this.logger.error(`Resposta IA inválida para anomalia obra=${obraId}: ${responseText.slice(0, 200)}`);
      iaResults = [];
    }

    // Audit trail
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO alm_ai_analises
         (tenant_id, tipo, referencia_id, resultado, modelo, duracao_ms)
       VALUES ($1, 'anomalia_consumo', $2, $3::jsonb, 'claude-haiku-4-5-20251001', $4)`,
      tenantId, obraId,
      JSON.stringify({ anomalias_detectadas: anomalias.length, resultados: iaResults }),
      duracaoMs,
    );

    // Mescla resultado IA com dados locais + cria alertas
    const resultado: AlmAnomaliaDetectada[] = anomalias.map((a) => {
      const ia = iaResults.find((r) => r.catalogo_id === a.catalogo_id);
      return {
        catalogo_id:        a.catalogo_id,
        catalogo_nome:      a.catalogo_nome,
        unidade:            a.unidade,
        consumo_recente_7d: a.consumo_recente_7d,
        consumo_medio_30d:  a.consumo_medio_30d,
        fator_desvio:       a.fator_desvio,
        obra_id:            obraId,
        nivel:              (ia?.nivel ?? (a.fator_desvio >= FATOR_ANOMALIA_CRITICO ? 'critico' : 'atencao')) as 'critico' | 'atencao',
        explicacao_ia:      ia?.explicacao_ia ?? `Consumo ${a.fator_desvio.toFixed(1)}x acima da média.`,
      };
    });

    // Persiste alertas para anomalias
    for (const a of resultado) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO alm_alertas_estoque
           (tenant_id, obra_id, catalogo_id, tipo, nivel, mensagem, lido)
         VALUES ($1, $2, $3, 'anomalia', $4, $5, false)
         ON CONFLICT DO NOTHING`,
        tenantId,
        obraId,
        a.catalogo_id,
        a.nivel,
        `${a.catalogo_nome}: consumo ${a.fator_desvio.toFixed(1)}x acima da média. ${a.explicacao_ia}`,
      );
    }

    this.logger.log(JSON.stringify({
      action:   'alm.anomalia.detectadas',
      obraId,
      tenantId,
      total:    resultado.length,
      critico:  resultado.filter((a) => a.nivel === 'critico').length,
    }));

    return resultado;
  }
}
