import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { EfetivoToolsService } from '../tools/efetivo.tools';
import { SUGGESTER_PROMPT } from '../prompts/suggester.prompt';
import type { SugestaoIA } from '../../types/efetivo.types';

@Injectable()
export class SuggesterAgent {
  private readonly logger = new Logger(SuggesterAgent.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly tools: EfetivoToolsService,
  ) {
    this.anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '' });
  }

  async sugerir(tenantId: number, obraId: number, turno: string): Promise<SugestaoIA> {
    const today = new Date();
    const diaSemana = today.getDay();

    const tools: Anthropic.Tool[] = [
      {
        name: 'get_obra_info',
        description: 'Retorna informações da obra',
        input_schema: { type: 'object' as const, properties: { obra_id: { type: 'number' } }, required: ['obra_id'] },
      },
      {
        name: 'get_historico_efetivo',
        description: 'Retorna histórico de registros de efetivo similares',
        input_schema: {
          type: 'object' as const,
          properties: {
            obra_id:    { type: 'number' },
            dia_semana: { type: 'number' },
            turno:      { type: 'string' },
            limit:      { type: 'number' },
          },
          required: ['obra_id'],
        },
      },
      {
        name: 'get_empresas_ativas',
        description: 'Lista empresas ativas do tenant',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'get_funcoes_ativas',
        description: 'Lista funções ativas do tenant',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Sugira a equipe para a obra ${obraId}, turno ${turno}, dia da semana ${diaSemana}. Retorne JSON: { itens: [{empresa_id, empresa_nome, funcao_id, funcao_nome, quantidade}], confianca: 0-100, base_registros: N, observacao: "..." }`,
      },
    ];

    let response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SUGGESTER_PROMPT,
      tools,
      messages,
    });

    // Tool calling loop
    while (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUses) {
        if (toolUse.type !== 'tool_use') continue;
        const input = toolUse.input as Record<string, unknown>;
        let result: unknown;

        try {
          if (toolUse.name === 'get_obra_info') {
            result = await this.tools.getObraInfo(tenantId, (input.obra_id as number) ?? obraId);
          } else if (toolUse.name === 'get_historico_efetivo') {
            result = await this.tools.getHistoricoEfetivo(
              tenantId,
              (input.obra_id as number) ?? obraId,
              input.dia_semana as number | undefined,
              input.turno as string | undefined,
              input.limit as number | undefined,
            );
          } else if (toolUse.name === 'get_empresas_ativas') {
            result = await this.tools.getEmpresasAtivas(tenantId);
          } else if (toolUse.name === 'get_funcoes_ativas') {
            result = await this.tools.getFuncoesAtivas(tenantId);
          }
        } catch (e: unknown) {
          result = { error: e instanceof Error ? e.message : String(e) };
        }

        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SUGGESTER_PROMPT,
        tools,
        messages,
      });
    }

    // Extract JSON from final response
    const text = response.content.find(b => b.type === 'text');
    if (!text || text.type !== 'text') {
      return { itens: [], confianca: 0, base_registros: 0, observacao: 'Sem dados históricos suficientes.' };
    }

    try {
      const jsonMatch = text.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no json');
      return JSON.parse(jsonMatch[0]) as SugestaoIA;
    } catch {
      this.logger.warn('SuggesterAgent: falha ao parsear JSON da resposta');
      return { itens: [], confianca: 0, base_registros: 0, observacao: 'Erro ao processar sugestão.' };
    }
  }
}
