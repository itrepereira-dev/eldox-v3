// backend/src/ai/agents/fvs/agente-diagnostico-nc.ts
// AGENTE-DIAGNOSTICO-NC — ao criar/registrar NC, sugere causa 6M, ação corretiva, prazo, responsável
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';

export interface AgenteDiagnosticoNcCtx {
  tenant_id: number;
  usuario_id: number;
  ficha_id: number;
  nc_id: number;
  servico_nome: string;
  item_nome: string;
  criticidade: string;
  descricao?: string;
  obra_nome: string;
}

export interface DiagnosticoNcResult {
  causa_6m: string;           // Mão de obra | Máquina | Material | Método | Meio ambiente | Medição
  descricao_causa: string;
  acao_corretiva: string;
  prazo_sugerido_dias: number;
  responsavel_sugerido: string;
  fonte: 'ia' | 'fallback';
}

const SISTEMA = `Você é um especialista em qualidade na construção civil (PBQP-H, ISO 9001).
Analise a não conformidade e retorne JSON com:
{
  "causa_6m": "<uma de: Mão de obra | Máquina | Material | Método | Meio ambiente | Medição>",
  "descricao_causa": "<1-2 frases objetivas sobre a provável causa>",
  "acao_corretiva": "<ação específica e mensurável para corrigir>",
  "prazo_sugerido_dias": <número inteiro entre 1 e 30>,
  "responsavel_sugerido": "<cargo ou função responsável, ex: Encarregado de Alvenaria>"
}
Responda SOMENTE o JSON, sem markdown.`;

@Injectable()
export class AgenteDiagnosticoNc {
  private readonly logger = new Logger(AgenteDiagnosticoNc.name);
  private readonly MODELO = 'claude-haiku-4-5-20251001';
  private readonly MAX_TOKENS = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgenteDiagnosticoNcCtx): Promise<DiagnosticoNcResult> {
    try {
      const userMsg = `Obra: ${ctx.obra_nome}
Serviço inspecionado: ${ctx.servico_nome}
Item da FVS: ${ctx.item_nome}
Criticidade: ${ctx.criticidade}
Descrição da NC: ${ctx.descricao ?? 'não informada'}`;

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO, SISTEMA, userMsg, this.MAX_TOKENS,
        ctx.tenant_id, ctx.usuario_id, 'fvs.diagnostico_nc',
      );

      const result = this.parse(texto);

      // Persiste sugestão na NC
      await this.prisma.$executeRawUnsafe(
        `UPDATE fvs_nao_conformidades
         SET ia_sugestao_json = $1::jsonb, ia_processado_em = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        JSON.stringify(result),
        ctx.nc_id,
        ctx.tenant_id,
      );

      return { ...result, fonte: 'ia' };
    } catch (err) {
      this.logger.warn(`AGENTE-DIAGNOSTICO-NC fallback (tenant=${ctx.tenant_id}): ${(err as Error).message}`);
      return this.fallback();
    }
  }

  private parse(texto: string): Omit<DiagnosticoNcResult, 'fonte'> {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const p = JSON.parse(clean);
    return {
      causa_6m: String(p.causa_6m ?? 'Método'),
      descricao_causa: String(p.descricao_causa ?? ''),
      acao_corretiva: String(p.acao_corretiva ?? ''),
      prazo_sugerido_dias: Math.max(1, Math.min(30, Number(p.prazo_sugerido_dias) || 7)),
      responsavel_sugerido: String(p.responsavel_sugerido ?? ''),
    };
  }

  private fallback(): DiagnosticoNcResult {
    return {
      causa_6m: 'Método',
      descricao_causa: 'Diagnóstico IA indisponível.',
      acao_corretiva: 'Verificar com equipe técnica.',
      prazo_sugerido_dias: 7,
      responsavel_sugerido: 'Responsável técnico',
      fonte: 'fallback',
    };
  }
}
