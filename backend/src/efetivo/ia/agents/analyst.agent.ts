import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { EfetivoToolsService } from '../tools/efetivo.tools';
import { ANALYST_PROMPT } from '../prompts/analyst.prompt';

@Injectable()
export class AnalystAgent {
  private readonly logger = new Logger(AnalystAgent.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly tools: EfetivoToolsService,
  ) {
    this.anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '' });
  }

  async analisar(tenantId: number, obraId: number, registroId: number): Promise<void> {
    const today = new Date();
    const diaSemana = today.getDay();

    const tools: Anthropic.Tool[] = [
      {
        name: 'get_historico_efetivo',
        description: 'Retorna histórico de registros de efetivo da obra',
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
        name: 'upsert_padrao_efetivo',
        description: 'Salva ou atualiza o padrão de efetivo para obra/dia_semana/turno',
        input_schema: {
          type: 'object' as const,
          properties: {
            obra_id:     { type: 'number' },
            dia_semana:  { type: 'number' },
            turno:       { type: 'string' },
            padrao_json: { type: 'object' },
          },
          required: ['obra_id', 'dia_semana', 'turno', 'padrao_json'],
        },
      },
    ];

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Analise o registro ${registroId} da obra ${obraId} (tenant ${tenantId}). Dia da semana atual: ${diaSemana}. Atualize o padrão histórico para o dia_semana e turno deste registro usando upsert_padrao_efetivo.`,
      },
    ];

    let response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: ANALYST_PROMPT,
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
          if (toolUse.name === 'get_historico_efetivo') {
            result = await this.tools.getHistoricoEfetivo(
              tenantId,
              (input.obra_id as number) ?? obraId,
              input.dia_semana as number | undefined,
              input.turno as string | undefined,
              input.limit as number | undefined,
            );
          } else if (toolUse.name === 'upsert_padrao_efetivo') {
            await this.tools.upsertPadraoEfetivo(
              tenantId,
              (input.obra_id as number) ?? obraId,
              input.dia_semana as number,
              input.turno as string,
              input.padrao_json as object,
            );
            result = { success: true };
          }
        } catch (e: unknown) {
          result = { error: e instanceof Error ? e.message : String(e) };
        }

        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: ANALYST_PROMPT,
        tools,
        messages,
      });
    }

    this.logger.log(`AnalystAgent: Análise concluída — obra=${obraId}, registro=${registroId}`);
  }
}
