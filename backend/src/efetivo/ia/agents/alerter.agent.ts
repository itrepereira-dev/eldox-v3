import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { EfetivoToolsService } from '../tools/efetivo.tools';
import { ALERTER_PROMPT } from '../prompts/alerter.prompt';

@Injectable()
export class AlerterAgent {
  private readonly logger = new Logger(AlerterAgent.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly tools: EfetivoToolsService,
  ) {
    this.anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '' });
  }

  async verificarAlertas(tenantId: number): Promise<void> {
    const tools: Anthropic.Tool[] = [
      {
        name: 'detectar_queda_efetivo',
        description: 'Detecta obras com queda brusca de efetivo (≥50%) comparando hoje vs média dos últimos 7 dias',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'detectar_empresa_ausente',
        description: 'Detecta empresas ausentes há N dias ou mais',
        input_schema: {
          type: 'object' as const,
          properties: { dias_minimos: { type: 'number', description: 'Número mínimo de dias de ausência (padrão 3)' } },
          required: [],
        },
      },
      {
        name: 'detectar_obra_parada',
        description: 'Detecta obras em andamento sem registro de efetivo nas últimas 24h',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'criar_alerta',
        description: 'Cria um alerta de efetivo no sistema',
        input_schema: {
          type: 'object' as const,
          properties: {
            obra_id:    { type: 'number', description: 'ID da obra (null se for alerta global)' },
            tipo:       { type: 'string', enum: ['queda_efetivo', 'empresa_ausente', 'obra_parada'] },
            severidade: { type: 'string', enum: ['warn', 'critical'] },
            mensagem:   { type: 'string' },
            detalhes:   { type: 'object' },
          },
          required: ['tipo', 'severidade', 'mensagem'],
        },
      },
    ];

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Verifique anomalias de efetivo para o tenant ${tenantId}. Use as ferramentas de detecção e crie alertas para cada anomalia encontrada.`,
      },
    ];

    let response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: ALERTER_PROMPT,
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
          if (toolUse.name === 'detectar_queda_efetivo') {
            result = await this.tools.detectarQuedaEfetivo(tenantId);
          } else if (toolUse.name === 'detectar_empresa_ausente') {
            result = await this.tools.detectarEmpresaAusente(
              tenantId,
              (input.dias_minimos as number | undefined) ?? 3,
            );
          } else if (toolUse.name === 'detectar_obra_parada') {
            result = await this.tools.detectarObraParada(tenantId);
          } else if (toolUse.name === 'criar_alerta') {
            await this.tools.criarAlerta(
              tenantId,
              (input.obra_id as number | null | undefined) ?? null,
              input.tipo as string,
              input.severidade as string,
              input.mensagem as string,
              input.detalhes as object | undefined,
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
        max_tokens: 2048,
        system: ALERTER_PROMPT,
        tools,
        messages,
      });
    }

    this.logger.log(`AlerterAgent: Alertas verificados — tenant=${tenantId}`);
  }
}
