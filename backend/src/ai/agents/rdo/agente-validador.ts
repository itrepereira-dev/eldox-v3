// /backend/src/ai/agents/rdo/agente-validador.ts
// AGENTE-VALIDADOR — Sonnet 4.6
// Handler name: 'rdo.validador'

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';
import { buildPromptValidador } from '../../prompts/rdo/validador.prompt';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AgenteValidadorCtx {
  obra_id: number;
  tenant_id: number;
  usuario_id: number;
  rdo: Record<string, unknown>;  // RDO completo em JSON
}

export interface Inconsistencia {
  tipo: 'bloqueante' | 'atencao' | 'sugestao';
  campo: string;
  mensagem: string;
  sugestao_correcao: string;
}

export interface AgenteValidadorResult {
  pode_enviar: boolean;
  inconsistencias: Inconsistencia[];
  fonte: 'ia' | 'fallback';
  tenant_id: number;
}

// ── Agente ────────────────────────────────────────────────────────────────────

@Injectable()
export class AgenteValidador {
  private readonly logger = new Logger(AgenteValidador.name);
  private readonly MODELO = 'claude-sonnet-4-6';
  private readonly MAX_TOKENS = 1500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgenteValidadorCtx): Promise<AgenteValidadorResult> {
    try {
      const { obraNome, historicoObra, regrasPbqph } = await this.carregarContexto(ctx);

      const { system, user } = buildPromptValidador({
        obra_nome: obraNome,
        tenant_id: ctx.tenant_id,
        rdo_json: JSON.stringify(ctx.rdo, null, 2),
        historico_obra: historicoObra,
        regras_pbqph: regrasPbqph,
      });

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO,
        system,
        user,
        this.MAX_TOKENS,
        ctx.tenant_id,
        ctx.usuario_id,
        'rdo.validador',
      );

      const resultado = this.parseResposta(texto);
      return { ...resultado, fonte: 'ia', tenant_id: ctx.tenant_id };
    } catch (err) {
      this.logger.warn(
        `AGENTE-VALIDADOR fallback ativado (tenant=${ctx.tenant_id}, obra=${ctx.obra_id}): ${(err as Error).message}`,
      );
      return this.fallback();
    }
  }

  // ── Contexto ────────────────────────────────────────────────────────────────

  private async carregarContexto(ctx: AgenteValidadorCtx) {
    const [obra, configuracoes, ultimosRdos] = await Promise.all([
      this.prisma.$queryRaw<Array<{ nome: string; data_inicio: string | null; data_prevista_fim: string | null }>>`
        SELECT nome, "dataInicioReal" AS data_inicio, "dataFimPrevista" AS data_prevista_fim
        FROM "Obra"
        WHERE id = ${ctx.obra_id} AND "tenantId" = ${ctx.tenant_id}
        LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ configuracoes_pbqph: unknown }>>`
        SELECT NULL AS configuracoes_pbqph
        FROM "Tenant"
        WHERE id = ${ctx.tenant_id}
        LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ data: string; ocorrencias: unknown; status: string }>>`
        SELECT data, ocorrencias, status
        FROM rdos
        WHERE obra_id = ${ctx.obra_id}
          AND tenant_id = ${ctx.tenant_id}
        ORDER BY data DESC
        LIMIT 5
      `,
    ]);

    const obraInfo = obra[0];
    const obraNome = obraInfo?.nome ?? `Obra #${ctx.obra_id}`;
    const historicoObra = JSON.stringify({
      data_inicio: obraInfo?.data_inicio,
      data_prevista_fim: obraInfo?.data_prevista_fim,
      rdos_recentes: ultimosRdos,
    });
    const regrasPbqph = JSON.stringify(configuracoes[0]?.configuracoes_pbqph ?? {});

    return { obraNome, historicoObra, regrasPbqph };
  }

  // ── Parse ───────────────────────────────────────────────────────────────────

  private parseResposta(texto: string): Pick<AgenteValidadorResult, 'pode_enviar' | 'inconsistencias'> {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(clean) as { pode_enviar?: unknown; inconsistencias?: unknown[] };
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Resposta não é objeto');

    const inconsistencias: Inconsistencia[] = (parsed.inconsistencias ?? []).map((inc: unknown) => {
      const i = inc as Partial<Inconsistencia>;
      return {
        tipo: (['bloqueante', 'atencao', 'sugestao'].includes(i.tipo ?? '') ? i.tipo : 'sugestao') as Inconsistencia['tipo'],
        campo: String(i.campo ?? 'geral'),
        mensagem: String(i.mensagem ?? ''),
        sugestao_correcao: String(i.sugestao_correcao ?? ''),
      };
    });

    const temBloqueante = inconsistencias.some((i) => i.tipo === 'bloqueante');
    return {
      pode_enviar: typeof parsed.pode_enviar === 'boolean' ? parsed.pode_enviar : !temBloqueante,
      inconsistencias,
    };
  }

  // ── Fallback ────────────────────────────────────────────────────────────────
  // ADR: Se validador falha, permite envio mas emite warning (módulo não pode ser bloqueado por IA)

  private fallback(): AgenteValidadorResult {
    this.logger.warn('AGENTE-VALIDADOR: retornando fallback permissivo — validação IA indisponível');
    return {
      pode_enviar: true,
      inconsistencias: [],
      fonte: 'fallback',
      tenant_id: 0, // será sobrescrito pelo chamador
    };
  }
}
