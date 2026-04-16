// /backend/src/ai/agents/rdo/agente-resumo.ts
// AGENTE-RESUMO — Sonnet 4.6
// Handler name: 'rdo.resumo'

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';
import { buildPromptResumo } from '../../prompts/rdo/resumo.prompt';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AgenteResumoCtx {
  obra_id: number;
  tenant_id: number;
  usuario_id: number;
  rdo_id: number;
  rdo: Record<string, unknown>;  // RDO aprovado completo
  data_rdo: string;              // ISO 8601
}

export interface AgenteResumoResult {
  texto: string;
  resumo_ia_editado: false;       // Sempre false ao criar — usuário pode mudar para true ao editar
  fonte: 'ia' | 'fallback';
  tenant_id: number;
}

// ── Agente ────────────────────────────────────────────────────────────────────

@Injectable()
export class AgenteResumo {
  private readonly logger = new Logger(AgenteResumo.name);
  private readonly MODELO = 'claude-sonnet-4-6';
  private readonly MAX_TOKENS = 400;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgenteResumoCtx): Promise<AgenteResumoResult> {
    try {
      const { obraNome, historicoObra, templateComentario } = await this.carregarContexto(ctx);

      const { system, user } = buildPromptResumo({
        obra_nome: obraNome,
        tenant_id: ctx.tenant_id,
        data_rdo: ctx.data_rdo,
        rdo_aprovado_json: JSON.stringify(ctx.rdo, null, 2),
        historico_obra: historicoObra,
        template_comentario: templateComentario,
      });

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO,
        system,
        user,
        this.MAX_TOKENS,
        ctx.tenant_id,
        ctx.usuario_id,
        'rdo.resumo',
      );

      // Remove aspas externas se o modelo as incluir inadvertidamente
      const textoLimpo = texto.trim().replace(/^["']|["']$/g, '').trim();

      return {
        texto: textoLimpo,
        resumo_ia_editado: false,
        fonte: 'ia',
        tenant_id: ctx.tenant_id,
      };
    } catch (err) {
      this.logger.warn(
        `AGENTE-RESUMO fallback ativado (tenant=${ctx.tenant_id}, obra=${ctx.obra_id}): ${(err as Error).message}`,
      );
      return this.fallback(ctx);
    }
  }

  // ── Contexto ────────────────────────────────────────────────────────────────

  private async carregarContexto(ctx: AgenteResumoCtx) {
    const [obra, template, rdosAnteriores] = await Promise.all([
      this.prisma.$queryRaw<Array<{ nome: string; tipo_obra: string | null }>>`
        SELECT o.nome, ot.nome AS tipo_obra
        FROM "Obra" o
        LEFT JOIN "ObraTipo" ot ON ot.id = o."obraTipoId"
        WHERE o.id = ${ctx.obra_id} AND o."tenantId" = ${ctx.tenant_id}
        LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ template_comentario_rdo: string | null }>>`
        SELECT NULL AS template_comentario_rdo
        FROM "Tenant"
        WHERE id = ${ctx.tenant_id}
        LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ data: string; resumo: string | null }>>`
        SELECT data, resumo
        FROM rdos
        WHERE obra_id = ${ctx.obra_id}
          AND tenant_id = ${ctx.tenant_id}
          AND id != ${ctx.rdo_id}
          AND resumo IS NOT NULL
        ORDER BY data DESC
        LIMIT 3
      `,
    ]);

    const obraInfo = obra[0];
    const historicoObra = JSON.stringify({
      tipo_obra: obraInfo?.tipo_obra,
      resumos_anteriores: rdosAnteriores,
    });

    return {
      obraNome: obraInfo?.nome ?? `Obra #${ctx.obra_id}`,
      historicoObra,
      templateComentario: template[0]?.template_comentario_rdo ?? '',
    };
  }

  // ── Fallback: string vazia (usuário preenche manualmente — ADR) ───────────

  private fallback(ctx: AgenteResumoCtx): AgenteResumoResult {
    return {
      texto: '',
      resumo_ia_editado: false,
      fonte: 'fallback',
      tenant_id: ctx.tenant_id,
    };
  }
}
