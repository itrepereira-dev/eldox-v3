// /backend/src/ai/agents/rdo/agente-campo.ts
// AGENTE-CAMPO — Sonnet 4.6 (WhatsApp — plano Corporativo)
// Handler name: 'rdo.campo'
// Integração: Meta Cloud API nativa

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IaService } from '../../../ia/ia.service';
import { buildPromptCampo } from '../../prompts/rdo/campo.prompt';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AgenteCampoCtx {
  tenant_id: number;
  usuario_id: number;
  obra_id: number;
  numero_whatsapp: string;
  mensagem_texto: string;
  fotos_base64?: string[];          // Fotos recebidas via WhatsApp
  transcricao_audio?: string;       // Transcrição gerada externamente (ex: Whisper)
  historico_conversa?: string;      // Últimas 3 mensagens da thread
}

export interface CamposExtraidos {
  data: string | null;
  clima: {
    manha: 'claro' | 'nublado' | 'chuvoso' | null;
    tarde: 'claro' | 'nublado' | 'chuvoso' | null;
    noite: 'claro' | 'nublado' | 'chuvoso' | null;
  } | null;
  equipe: Array<{ funcao: string; quantidade: number }>;
  atividades: Array<{ descricao: string; progresso_pct: number | null }>;
  ocorrencias: Array<{ descricao: string; tipo: string }>;
  materiais: Array<{ nome: string; quantidade: string }>;
  observacoes: string | null;
}

export interface AgenteCampoResult {
  acao: 'rascunho_criado' | 'solicitar_confirmacao' | 'erro';
  rdo_id: number | null;
  resumo_para_usuario: string;
  campos_extraidos: CamposExtraidos;
  fonte: 'ia' | 'fallback';
  tenant_id: number;
}

// ── Agente ────────────────────────────────────────────────────────────────────

@Injectable()
export class AgenteCampo {
  private readonly logger = new Logger(AgenteCampo.name);
  private readonly MODELO = 'claude-sonnet-4-6';
  private readonly MAX_TOKENS = 1200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iaService: IaService,
  ) {}

  async executar(ctx: AgenteCampoCtx): Promise<AgenteCampoResult> {
    try {
      const { obraNome, usuarioNome } = await this.carregarContexto(ctx);

      // Descreve fotos sem enviar base64 ao LLM (reduz tokens)
      const fotosDescricao = ctx.fotos_base64
        ? `${ctx.fotos_base64.length} foto(s) recebida(s) via WhatsApp.`
        : undefined;

      const { system, user } = buildPromptCampo({
        tenant_id: ctx.tenant_id,
        obra_id: ctx.obra_id,
        obra_nome: obraNome,
        numero_whatsapp: ctx.numero_whatsapp,
        usuario_nome: usuarioNome,
        mensagem_texto: ctx.mensagem_texto,
        transcricao_audio: ctx.transcricao_audio,
        fotos_descricao: fotosDescricao,
        historico_conversa: ctx.historico_conversa,
        data_hoje: new Date().toISOString().split('T')[0],
      });

      const texto = await this.iaService.callClaudeForAgent(
        this.MODELO,
        system,
        user,
        this.MAX_TOKENS,
        ctx.tenant_id,
        ctx.usuario_id,
        'rdo.campo',
      );

      const resultado = this.parseResposta(texto);

      // Se ação é rascunho_criado, persiste o rascunho
      let rdoId: number | null = null;
      if (resultado.acao === 'rascunho_criado') {
        rdoId = await this.criarRascunho(ctx, resultado.campos_extraidos);
      }

      return {
        ...resultado,
        rdo_id: rdoId,
        fonte: 'ia',
        tenant_id: ctx.tenant_id,
      };
    } catch (err) {
      this.logger.warn(
        `AGENTE-CAMPO fallback ativado (tenant=${ctx.tenant_id}, obra=${ctx.obra_id}): ${(err as Error).message}`,
      );
      return this.fallback(ctx);
    }
  }

  // ── Contexto ────────────────────────────────────────────────────────────────

  private async carregarContexto(ctx: AgenteCampoCtx) {
    const [obra, usuario] = await Promise.all([
      this.prisma.$queryRaw<Array<{ nome: string }>>`
        SELECT nome FROM "Obra" WHERE id = ${ctx.obra_id} AND tenant_id = ${ctx.tenant_id} LIMIT 1
      `,
      this.prisma.$queryRaw<Array<{ nome: string }>>`
        SELECT nome FROM "Usuario" WHERE id = ${ctx.usuario_id} LIMIT 1
      `,
    ]);
    return {
      obraNome: obra[0]?.nome ?? `Obra #${ctx.obra_id}`,
      usuarioNome: usuario[0]?.nome ?? 'Usuário',
    };
  }

  // ── Persistir rascunho ───────────────────────────────────────────────────────

  private async criarRascunho(ctx: AgenteCampoCtx, campos: CamposExtraidos): Promise<number | null> {
    try {
      const dataRdo = campos.data ?? new Date().toISOString().split('T')[0];
      const result = await this.prisma.$queryRaw<Array<{ id: number }>>`
        INSERT INTO rdos (
          tenant_id, obra_id, usuario_id, data, status,
          equipe, atividades, ocorrencias, observacoes,
          origem, created_at, updated_at
        ) VALUES (
          ${ctx.tenant_id}, ${ctx.obra_id}, ${ctx.usuario_id},
          ${dataRdo}::date, 'rascunho',
          ${JSON.stringify(campos.equipe)}::jsonb,
          ${JSON.stringify(campos.atividades)}::jsonb,
          ${JSON.stringify(campos.ocorrencias)}::jsonb,
          ${campos.observacoes ?? ''},
          'whatsapp', NOW(), NOW()
        )
        RETURNING id
      `;
      return result[0]?.id ?? null;
    } catch (err) {
      this.logger.error(`AGENTE-CAMPO: falha ao criar rascunho: ${(err as Error).message}`);
      return null;
    }
  }

  // ── Parse ───────────────────────────────────────────────────────────────────

  private parseResposta(texto: string): Omit<AgenteCampoResult, 'rdo_id' | 'fonte' | 'tenant_id'> {
    const clean = texto.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(clean) as {
      acao?: unknown;
      resumo_para_usuario?: unknown;
      campos_extraidos?: Partial<CamposExtraidos>;
    };

    const acoes = ['rascunho_criado', 'solicitar_confirmacao', 'erro'];
    const acao = acoes.includes(String(parsed.acao)) ? (parsed.acao as AgenteCampoResult['acao']) : 'erro';

    const campos = parsed.campos_extraidos ?? {};
    const camposExtraidos: CamposExtraidos = {
      data: typeof campos.data === 'string' ? campos.data : null,
      clima: campos.clima ?? null,
      equipe: Array.isArray(campos.equipe) ? campos.equipe : [],
      atividades: Array.isArray(campos.atividades) ? campos.atividades : [],
      ocorrencias: Array.isArray(campos.ocorrencias) ? campos.ocorrencias : [],
      materiais: Array.isArray(campos.materiais) ? campos.materiais : [],
      observacoes: typeof campos.observacoes === 'string' ? campos.observacoes : null,
    };

    return {
      acao,
      resumo_para_usuario: String(parsed.resumo_para_usuario ?? 'Não foi possível processar sua mensagem. Por favor, acesse o sistema web.').slice(0, 300),
      campos_extraidos: camposExtraidos,
    };
  }

  // ── Fallback: orienta acesso ao sistema web ──────────────────────────────

  private fallback(ctx: AgenteCampoCtx): AgenteCampoResult {
    return {
      acao: 'erro',
      rdo_id: null,
      resumo_para_usuario:
        'Desculpe, não consegui processar sua mensagem agora. Por favor, acesse o sistema Eldox pelo navegador para registrar o RDO. 🏗️',
      campos_extraidos: {
        data: null,
        clima: null,
        equipe: [],
        atividades: [],
        ocorrencias: [],
        materiais: [],
        observacoes: null,
      },
      fonte: 'fallback',
      tenant_id: ctx.tenant_id,
    };
  }
}
