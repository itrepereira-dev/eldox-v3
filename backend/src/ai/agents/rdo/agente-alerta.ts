// /backend/src/ai/agents/rdo/agente-alerta.ts
// AGENTE-ALERTA — Haiku 4.5
// Handler name: 'rdo.alerta'
// Executado como BullMQ job agendado (cron diário)

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';
import { buildPromptAlerta } from '../../prompts/rdo/alerta.prompt';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AgenteAlertaCtx {
  tenant_id: number;
  // usuario_id do sistema (job scheduler) — para rate limit e log
  sistema_usuario_id: number;
  data_referencia: string;  // ISO 8601
}

export interface AlertaRdo {
  obra_id: number;
  obra_nome: string;
  tipo: 'prazo_critico' | 'atraso_fisico' | 'improdutividade_recorrente' | 'sem_rdo' | 'ocorrencia_grave' | 'meta_atingida' | 'custom';
  severidade: 'critica' | 'alta' | 'media' | 'info';
  titulo: string;
  mensagem: string;
  dados_adicionais: Record<string, unknown>;
}

export interface AgenteAlertaResult {
  alertas: AlertaRdo[];
  fonte: 'ia' | 'fallback';
  tenant_id: number;
  data_referencia: string;
}

// ── Agente ────────────────────────────────────────────────────────────────────

@Injectable()
export class AgenteAlerta {
  private readonly logger = new Logger(AgenteAlerta.name);
  private readonly MODELO = 'claude-haiku-4-5-20251001';
  private readonly MAX_TOKENS = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgenteAlertaCtx): Promise<AgenteAlertaResult> {
    try {
      const { configuracaoAlertas, rdos48h, obrasAtivas } = await this.carregarContexto(ctx);

      const { system, user } = buildPromptAlerta({
        tenant_id: ctx.tenant_id,
        configuracao_alertas: JSON.stringify(configuracaoAlertas),
        rdos_48h: JSON.stringify(rdos48h),
        obras_ativas: JSON.stringify(obrasAtivas),
        data_referencia: ctx.data_referencia,
      });

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO,
        system,
        user,
        this.MAX_TOKENS,
        ctx.tenant_id,
        ctx.sistema_usuario_id,
        'rdo.alerta',
      );

      const alertas = this.parseResposta(texto);
      return { alertas, fonte: 'ia', tenant_id: ctx.tenant_id, data_referencia: ctx.data_referencia };
    } catch (err) {
      this.logger.warn(
        `AGENTE-ALERTA fallback ativado (tenant=${ctx.tenant_id}): ${(err as Error).message}`,
      );
      return this.fallback(ctx);
    }
  }

  // ── Contexto ────────────────────────────────────────────────────────────────

  private async carregarContexto(ctx: AgenteAlertaCtx) {
    const limite48h = new Date(new Date(ctx.data_referencia).getTime() - 48 * 3600 * 1000).toISOString();

    const [configuracaoRows, rdos48hRows, obrasRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ configuracoes_alertas: unknown }>>`
        SELECT NULL AS configuracoes_alertas FROM "Tenant" WHERE id = ${ctx.tenant_id} LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ id: number; obra_id: number; data: string; status: string }>>`
        SELECT r.id, r.obra_id, r.data, r.status
        FROM rdos r
        JOIN "Obra" o ON o.id = r.obra_id
        WHERE r.tenant_id = ${ctx.tenant_id}
          AND r.created_at >= ${limite48h}
          AND o."deletadoEm" IS NULL
        ORDER BY r.data DESC
        LIMIT 100
      `,
      this.prisma.$queryRaw<Array<{ id: number; nome: string; data_prevista_fim: string | null }>>`
        SELECT id, nome, "dataFimPrevista" AS data_prevista_fim
        FROM "Obra"
        WHERE "tenantId" = ${ctx.tenant_id}
          AND "deletadoEm" IS NULL
        ORDER BY "dataFimPrevista" ASC NULLS LAST
        LIMIT 50
      `,
    ]);

    return {
      configuracaoAlertas: configuracaoRows[0]?.configuracoes_alertas ?? {},
      rdos48h: rdos48hRows,
      obrasAtivas: obrasRows,
    };
  }

  // ── Parse ───────────────────────────────────────────────────────────────────

  private parseResposta(texto: string): AlertaRdo[] {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(clean) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Resposta não é array');
    return (parsed as AlertaRdo[]).slice(0, 10).map((item) => ({
      obra_id: Number(item.obra_id),
      obra_nome: String(item.obra_nome ?? ''),
      tipo: item.tipo,
      severidade: item.severidade,
      titulo: String(item.titulo ?? '').slice(0, 60),
      mensagem: String(item.mensagem ?? '').slice(0, 160),
      dados_adicionais: (item.dados_adicionais as Record<string, unknown>) ?? {},
    }));
  }

  // ── Fallback: alertas básicos por regras simples (sem IA) ─────────────────

  private async fallback(ctx: AgenteAlertaCtx): Promise<AgenteAlertaResult> {
    const alertas: AlertaRdo[] = [];

    try {
      // Regra simples 1: obras sem RDO ontem
      const ontem = new Date(new Date(ctx.data_referencia).getTime() - 24 * 3600 * 1000)
        .toISOString()
        .split('T')[0];

      const semRdo = await this.prisma.$queryRaw<Array<{ id: number; nome: string }>>`
        SELECT o.id, o.nome
        FROM "Obra" o
        WHERE o."tenantId" = ${ctx.tenant_id}
          AND o."deletadoEm" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM rdos r
            WHERE r.obra_id = o.id
              AND r.tenant_id = ${ctx.tenant_id}
              AND r.data::date = ${ontem}::date
          )
        LIMIT 10
      `;

      for (const obra of semRdo) {
        alertas.push({
          obra_id: obra.id,
          obra_nome: obra.nome,
          tipo: 'sem_rdo',
          severidade: 'alta',
          titulo: `Sem RDO: ${obra.nome.slice(0, 40)}`,
          mensagem: `Nenhum RDO foi registrado para esta obra ontem (${ontem}).`,
          dados_adicionais: { data_ausente: ontem },
        });
      }

      // Regra simples 2: obras com prazo crítico (< 15 dias)
      const prazoCritico = new Date(new Date(ctx.data_referencia).getTime() + 15 * 24 * 3600 * 1000)
        .toISOString()
        .split('T')[0];

      const prazoRows = await this.prisma.$queryRaw<Array<{ id: number; nome: string; data_prevista_fim: string | null }>>`
        SELECT id, nome, "dataFimPrevista" AS data_prevista_fim
        FROM "Obra"
        WHERE "tenantId" = ${ctx.tenant_id}
          AND "deletadoEm" IS NULL
          AND "dataFimPrevista" IS NOT NULL
          AND "dataFimPrevista" <= ${prazoCritico}
        LIMIT 5
      `;

      for (const obra of prazoRows) {
        alertas.push({
          obra_id: obra.id,
          obra_nome: obra.nome,
          tipo: 'prazo_critico',
          severidade: 'critica',
          titulo: `Prazo crítico: ${obra.nome.slice(0, 35)}`,
          mensagem: `Prazo em ${obra.data_prevista_fim ?? 'data não definida'}. Verifique o avanço físico.`,
          dados_adicionais: { data_prevista_fim: obra.data_prevista_fim },
        });
      }
    } catch (fallbackErr) {
      this.logger.error(`AGENTE-ALERTA fallback DB falhou: ${(fallbackErr as Error).message}`);
    }

    return { alertas, fonte: 'fallback', tenant_id: ctx.tenant_id, data_referencia: ctx.data_referencia };
  }
}
