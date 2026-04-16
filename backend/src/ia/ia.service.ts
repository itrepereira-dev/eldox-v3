// backend/src/ia/ia.service.ts
import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import type { GerarCatalogoDto } from './dto/gerar-catalogo.dto';
import type { AssistenteFvsDto } from './dto/assistente.dto';
import type { ChatMasterDto } from './dto/chat-master.dto';

// Preço estimado por 1 000 tokens (USD) — modelos em uso
const COST_PER_1K: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6':      { in: 0.003,  out: 0.015  },
  'claude-haiku-4-5-20251001': { in: 0.00025, out: 0.00125 },
};

const RATE_LIMIT_PER_HORA = 20; // chamadas por user por handler

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '',
    });
  }

  // ── Rate limit ───────────────────────────────────────────────────────────────

  private async checkRateLimit(usuarioId: number, handler: string): Promise<void> {
    const since = new Date(Date.now() - 3600 * 1000); // última hora
    const count: { count: bigint }[] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::bigint as count
      FROM ai_usage_log
      WHERE usuario_id   = ${usuarioId}
        AND handler_name = ${handler}
        AND created_at  >= ${since}
    `;
    const used = Number(count[0]?.count ?? 0);
    if (used >= RATE_LIMIT_PER_HORA) {
      throw new HttpException(
        `Limite de ${RATE_LIMIT_PER_HORA} chamadas/hora atingido para ${handler}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // ── Log de uso ───────────────────────────────────────────────────────────────

  private async logUsage(
    tenantId: number,
    usuarioId: number,
    handler: string,
    modelo: string,
    tokensIn: number,
    tokensOut: number,
    duracaoMs: number,
  ): Promise<void> {
    const preco = COST_PER_1K[modelo] ?? { in: 0, out: 0 };
    const custo = (tokensIn / 1000) * preco.in + (tokensOut / 1000) * preco.out;
    await this.prisma.$executeRaw`
      INSERT INTO ai_usage_log
        (tenant_id, usuario_id, handler_name, modelo, tokens_in, tokens_out, custo_estimado, duracao_ms)
      VALUES
        (${tenantId}, ${usuarioId}, ${handler}, ${modelo}, ${tokensIn}, ${tokensOut}, ${custo}, ${duracaoMs})
    `;
  }

  // ── Chamada pública para agentes de módulos externos (RDO, GED, etc.) ────────

  async callClaudeForAgent(
    modelo: string,
    system: string,
    userMessage: string,
    maxTokens: number,
    tenantId: number,
    usuarioId: number,
    handlerName: string,
  ): Promise<string> {
    await this.checkRateLimit(usuarioId, handlerName);
    const { text, tokensIn, tokensOut, duracaoMs } = await this.callClaude(
      modelo, system, userMessage, maxTokens,
    );
    await this.logUsage(tenantId, usuarioId, handlerName, modelo, tokensIn, tokensOut, duracaoMs);
    return text;
  }

  // ── Chamada com imagem (vision) ───────────────────────────────────────────────

  async callClaudeWithImage(
    modelo: string,
    system: string,
    userMessage: string,
    imageBase64: string,
    mimeType: string,
    maxTokens: number,
    tenantId: number,
    usuarioId: number,
    handlerName: string,
  ): Promise<string> {
    await this.checkRateLimit(usuarioId, handlerName);

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new InternalServerErrorException('ANTHROPIC_API_KEY não configurada');

    const inicio = Date.now();
    const response = await this.anthropic.messages.create({
      model: modelo,
      max_tokens: maxTokens,
      system,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          { type: 'text', text: userMessage },
        ],
      }],
    });

    const duracaoMs = Date.now() - inicio;
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    await this.logUsage(tenantId, usuarioId, handlerName, modelo, response.usage.input_tokens, response.usage.output_tokens, duracaoMs);
    return text;
  }

  // ── Chamada base ao Claude ────────────────────────────────────────────────────

  private async callClaude(
    modelo: string,
    system: string,
    userMessage: string,
    maxTokens: number,
  ): Promise<{ text: string; tokensIn: number; tokensOut: number; duracaoMs: number }> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ANTHROPIC_API_KEY não configurada');
    }

    const inicio = Date.now();
    const response = await this.anthropic.messages.create({
      model: modelo,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });

    const duracaoMs = Date.now() - inicio;
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return {
      text,
      tokensIn:  response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      duracaoMs,
    };
  }

  // ── Gerar Catálogo de Serviços ────────────────────────────────────────────────

  async gerarCatalogo(
    tenantId: number,
    usuarioId: number,
    dto: GerarCatalogoDto,
  ) {
    const handler = 'fvs.gerarCatalogo';
    const modelo  = 'claude-sonnet-4-6';

    await this.checkRateLimit(usuarioId, handler);

    const system = `Você é especialista em qualidade na construção civil (PBQP-H, ISO 9001, NBR 15575).
Gere um catálogo completo de serviços e itens de verificação para inspeção de qualidade (FVS).
Retorne APENAS JSON válido, sem markdown, sem texto adicional.
Formato: {"servicos":[{"nome":"string","codigo":"string","categoria":"string","norma_referencia":"string","itens":[{"descricao":"string","criterio_aceite":"string","criticidade":"maior|menor|critico","foto_modo":"nenhuma|opcional|obrigatoria"}]}]}`;

    const nivelMap: Record<string, string> = {
      basico:        'Gere itens essenciais, objetivos e diretos.',
      intermediario: 'Gere itens completos com critérios de aceitação detalhados.',
      avancado:      'Gere itens exaustivos com critérios técnicos precisos, tolerâncias e referências normativas.',
    };

    const userMsg = `Tipo de obra: ${dto.tipo_obra}
${dto.servicos  ? `Serviços desejados: ${dto.servicos}`  : 'Gere os serviços mais relevantes para este tipo de obra.'}
${dto.normas    ? `Normas a referenciar: ${dto.normas}`  : ''}
Nível de detalhe: ${nivelMap[dto.nivel_detalhe] ?? nivelMap.intermediario}
Gere o catálogo JSON agora.`;

    const { text, tokensIn, tokensOut, duracaoMs } = await this.callClaude(
      modelo, system, userMsg, 4000,
    );

    await this.logUsage(tenantId, usuarioId, handler, modelo, tokensIn, tokensOut, duracaoMs);

    return this.parseJsonResponse(text, 'servicos');
  }

  // ── Gerar Modelo FVS ──────────────────────────────────────────────────────────

  async gerarModeloFvs(
    tenantId: number,
    usuarioId: number,
    dto: GerarCatalogoDto,
  ) {
    const handler = 'fvs.gerarModelo';
    const modelo  = 'claude-sonnet-4-6';

    await this.checkRateLimit(usuarioId, handler);

    const system = `Você é especialista em qualidade na construção civil.
Gere um modelo de FVS (Ficha de Verificação de Serviço) completo.
Retorne APENAS JSON válido, sem markdown.
Formato: {"nome":"string","servicos_ids":[],"configuracoes":{"exige_ro":false,"exige_reinsspecao":false,"exige_parecer":false},"checklist":[{"servico":"string","itens":[{"descricao":"string","criterio_aceite":"string","criticidade":"maior|menor|critico","foto_modo":"nenhuma|opcional|obrigatoria"}]}]}`;

    const userMsg = `Tipo de obra: ${dto.tipo_obra}
${dto.servicos ? `Serviços: ${dto.servicos}` : ''}
${dto.normas   ? `Normas: ${dto.normas}` : ''}
Nível: ${dto.nivel_detalhe}
Gere o modelo FVS JSON agora.`;

    const { text, tokensIn, tokensOut, duracaoMs } = await this.callClaude(
      modelo, system, userMsg, 3000,
    );

    await this.logUsage(tenantId, usuarioId, handler, modelo, tokensIn, tokensOut, duracaoMs);

    return this.parseJsonResponse(text, 'checklist');
  }

  // ── Assistente de Pré-Inspeção ────────────────────────────────────────────────

  async assistenteFvs(
    tenantId: number,
    usuarioId: number,
    dto: AssistenteFvsDto,
  ) {
    const handler = 'fvs.assistente';
    const modelo  = 'claude-haiku-4-5-20251001';

    await this.checkRateLimit(usuarioId, handler);

    const system = `Você é um assistente de qualidade para inspeções de obras.
Analise o contexto fornecido e retorne APENAS JSON válido, sem markdown.
Formato: {"pontos_atencao":[{"item":"string","motivo":"string","criticidade":"alta|media|baixa"}],"dicas_inspecao":["string"]}`;

    const userMsg = `Contexto da inspeção:\n${dto.contexto}\n\nGere os pontos de atenção e dicas para esta inspeção.`;

    const { text, tokensIn, tokensOut, duracaoMs } = await this.callClaude(
      modelo, system, userMsg, 800,
    );

    await this.logUsage(tenantId, usuarioId, handler, modelo, tokensIn, tokensOut, duracaoMs);

    return this.parseJsonResponse(text, 'pontos_atencao');
  }

  // ── Agente Master (copilot de navegação) ─────────────────────────────────────

  async chatMaster(tenantId: number, usuarioId: number, dto: ChatMasterDto) {
    await this.checkRateLimit(usuarioId, 'ia.chat_master');

    const system = `Você é o Eldo, assistente inteligente do sistema Eldox — plataforma de gestão de qualidade em obras de construção civil.

Sua função é ajudar usuários a navegar no sistema e iniciar qualquer processo. Responda SEMPRE em português brasileiro, de forma concisa, amigável e direta.

MÓDULOS E ROTAS DO SISTEMA:
- Dashboard principal: /dashboard
- Obras: listar=/obras | nova obra=/obras/nova | detalhe=/obras/:id
- FVS - Inspeções: listar=/fvs/fichas | nova inspeção=/fvs/fichas/nova | templates=/fvs/modelos | dashboard=/fvs/dashboard
- Não Conformidades: /ncs
- Concretagem: dashboard=/obras/:obraId/concretagem | betonadas=/obras/:obraId/concretagem/betonadas | croqui=/obras/:obraId/concretagem/croqui
- Ensaios: conformidade=/obras/:obraId/ensaios | laboratoriais=/obras/:obraId/ensaios/laboratoriais | revisões=/obras/:obraId/ensaios/revisoes
- FVM Materiais: controle=/fvm/obras/:obraId | catálogo=/fvm/catalogo | fornecedores=/fvm/fornecedores
- Almoxarifado: dashboard=/obras/:obraId/almoxarifado | estoque=/obras/:obraId/almoxarifado/estoque | solicitações=/obras/:obraId/almoxarifado/solicitacoes | compras=/obras/:obraId/almoxarifado/ocs | NF-e=/obras/:obraId/almoxarifado/nfes | planejamento=/obras/:obraId/almoxarifado/planejamento
- Diário de Obra (RDO): /diario
- GED Documentos: /ged/admin
- Efetivo/Mão de obra: /obras/:obraId/efetivo
- Aprovações: /aprovacoes
- Semáforo PBQP-H: /semaforo
- Configurações: serviços FVS=/configuracoes/fvs/catalogo | tipos de ensaio=/configuracoes/ensaios/tipos | cadastros efetivo=/configuracoes/efetivo/cadastros

INSTRUÇÕES DE RESPOSTA:
Você DEVE responder SEMPRE com JSON válido neste formato:
{
  "resposta": "texto da resposta ao usuário",
  "acao": { "tipo": "navegar", "rota": "/rota", "label": "Nome legível da página" },
  "sugestoes": ["sugestão de próxima ação 1", "sugestão 2", "sugestão 3"]
}

- "acao" é OPCIONAL — inclua apenas quando o usuário quer navegar ou iniciar um processo
- "sugestoes" são chips de próxima ação — inclua sempre 2 a 3 opções relevantes ao contexto
- Rotas com :obraId ou :id são dinâmicas — use a rota sem o parâmetro quando não souber o ID (ex: /obras)
- Se o usuário perguntar algo que não é navegação, responda normalmente sem "acao"
- Seja breve: máximo 2 frases na "resposta"`;

    const start = Date.now();
    const modelo = 'claude-haiku-4-5-20251001';

    const messages: Anthropic.MessageParam[] = [
      ...(dto.historico ?? []).map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      {
        role: 'user' as const,
        content: dto.rota_atual
          ? `[Usuário está na rota: ${dto.rota_atual}]\n\n${dto.message}`
          : dto.message,
      },
    ];

    const resp = await this.anthropic.messages.create({
      model: modelo,
      max_tokens: 512,
      system,
      messages,
    });

    const duracao = Date.now() - start;
    const tokensIn  = resp.usage.input_tokens;
    const tokensOut = resp.usage.output_tokens;

    await this.logUsage(tenantId, usuarioId, 'ia.chat_master', modelo, tokensIn, tokensOut, duracao);

    const raw = resp.content[0]?.type === 'text' ? resp.content[0].text : '{}';

    // Extrai JSON da resposta (pode vir com markdown code block)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: { resposta: string; acao?: { tipo: string; rota: string; label: string }; sugestoes?: string[] };
    try {
      parsed = JSON.parse(jsonMatch?.[0] ?? '{}');
    } catch {
      parsed = { resposta: raw, sugestoes: ['Ver Dashboard', 'Abrir Obras'] };
    }

    return {
      resposta: parsed.resposta ?? 'Como posso ajudar?',
      acao:     parsed.acao,
      sugestoes: parsed.sugestoes ?? [],
    };
  }

  // ── Helper: parsear JSON da resposta ──────────────────────────────────────────

  private parseJsonResponse(text: string, expectedField: string): unknown {
    // Remove possível markdown code fence se o modelo insistir
    const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch {
      this.logger.error(`JSON inválido na resposta IA: ${clean.slice(0, 200)}`);
      throw new BadRequestException('Resposta da IA não é JSON válido. Tente novamente.');
    }
    if (typeof parsed !== 'object' || parsed === null || !(expectedField in parsed)) {
      throw new BadRequestException(`Resposta da IA não contém campo "${expectedField}". Tente novamente.`);
    }
    return parsed;
  }
}
