// backend/src/concretagem/croqui/planta-ia.service.ts
// EldoX.IA — Análise de Planta Estrutural para Croqui de Rastreabilidade
import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type {
  Base64ImageSource,
  ImageBlockParam,
  TextBlockParam,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages/messages';
import { PrismaService } from '../../prisma/prisma.service';
import type { AnalisarPlantaDto } from './dto/analisar-planta.dto';

const MODELO = 'claude-sonnet-4-6';
const HANDLER = 'concretagem.analisarPlanta';
const RATE_LIMIT = 10; // chamadas/hora por usuário (ADR-032)
const CONFIANCA_MINIMA = 0.40;

const COST_PER_1K = { in: 0.003, out: 0.015 }; // sonnet pricing

export interface ElementoCroqui {
  id: string;
  tipo: 'painel_laje' | 'pilar' | 'viga' | 'outro';
  label: string;
  col: number;
  row: number;
  colspan: number;
  rowspan: number;
}

export interface AnalisarPlantaResult {
  eixos_x: string[];
  eixos_y: string[];
  elementos: ElementoCroqui[];
  confianca: number;
  observacoes: string | null;
  tokens_in: number;
  tokens_out: number;
}

const RESULTADO_VAZIO = (obs: string): AnalisarPlantaResult => ({
  eixos_x: [], eixos_y: [], elementos: [],
  confianca: 0,
  observacoes: obs,
  tokens_in: 0, tokens_out: 0,
});

@Injectable()
export class PlantaIaService {
  private readonly logger = new Logger(PlantaIaService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  // ── Rate limit ────────────────────────────────────────────────────────────

  private async checkRateLimit(userId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count
       FROM ai_usage_log
       WHERE handler_name = $1
         AND usuario_id   = $2
         AND created_at  >= NOW() - INTERVAL '1 hour'`,
      HANDLER,
      userId,
    );
    if ((rows[0]?.count ?? 0) >= RATE_LIMIT) {
      throw new HttpException(
        `Limite de ${RATE_LIMIT} análises/hora atingido`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // ── Log de uso ────────────────────────────────────────────────────────────

  private logUsage(
    tenantId: number,
    userId: number,
    tokensIn: number,
    tokensOut: number,
    duracaoMs: number,
  ): void {
    const custo =
      (tokensIn / 1000) * COST_PER_1K.in +
      (tokensOut / 1000) * COST_PER_1K.out;

    this.prisma
      .$executeRawUnsafe(
        `INSERT INTO ai_usage_log
           (tenant_id, usuario_id, handler_name, modelo, tokens_in, tokens_out, custo_estimado, duracao_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        tenantId, userId, HANDLER, MODELO,
        tokensIn, tokensOut, custo, duracaoMs,
      )
      .catch((err: unknown) => this.logger.error(`logUsage falhou: ${String(err)}`));
  }

  // ── Prompt ────────────────────────────────────────────────────────────────

  private buildPrompt(contexto?: string): string {
    return `Analise esta planta estrutural${contexto ? ` (${contexto})` : ''} e extraia os elementos de concretagem.

Identifique:
- Eixos horizontais (letras: A, B, C...) e verticais (números: 1, 2, 3...)
- Painéis de laje, pilares e vigas com seus identificadores
- Nomes/labels de cada elemento como aparecem na planta

Regras:
- Foque em topologia (quais elementos existem e seus nomes), não em escala exata
- Cada elemento deve ter uma posição única em col/row na grade de eixos
- colspan/rowspan indicam quantas células o elemento ocupa (default 1)
- Se a planta for ilegível ou muito complexa, retorne confianca < 0.40 e elementos vazio

Retorne APENAS o seguinte JSON válido, sem markdown:
{
  "eixos_x": ["A","B","C"],
  "eixos_y": ["1","2","3"],
  "elementos": [
    {
      "id": "A1",
      "tipo": "painel_laje",
      "label": "A1",
      "col": 0,
      "row": 0,
      "colspan": 1,
      "rowspan": 1
    }
  ],
  "confianca": 0.85,
  "observacoes": "Grade regular 3x3 identificada."
}`;
  }

  // ── Chamada ao Claude com image block ─────────────────────────────────────

  private async callClaude(
    dto: AnalisarPlantaDto,
  ): Promise<{ text: string; tokensIn: number; tokensOut: number; duracaoMs: number }> {
    const anthropic = this.anthropic!;

    // PDF: converte para imagem via document block — usa jpeg para fotos, png para screenshots
    const mediaType =
      dto.mime_type === 'application/pdf'
        ? 'image/jpeg' // PDF enviado como imagem renderizada pelo frontend
        : (dto.mime_type as 'image/jpeg' | 'image/png');

    const imageSource: Base64ImageSource = {
      type: 'base64',
      media_type: mediaType,
      data: dto.arquivo_base64,
    };

    const imageBlock: ImageBlockParam = {
      type: 'image',
      source: imageSource,
    };

    const textBlock: TextBlockParam = {
      type: 'text',
      text: this.buildPrompt(dto.contexto),
    };

    const userMessage: MessageParam = {
      role: 'user',
      content: [imageBlock, textBlock],
    };

    const inicio = Date.now();
    const response = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 2048,
      system:
        'Você é especialista em engenharia estrutural. ' +
        'Analisa plantas de concretagem e extrai elementos com precisão. ' +
        'Retorna APENAS JSON válido, sem markdown, sem texto adicional.',
      messages: [userMessage],
    });

    const duracaoMs = Date.now() - inicio;
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return {
      text,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      duracaoMs,
    };
  }

  // ── Parse da resposta ─────────────────────────────────────────────────────

  private parseResposta(text: string): AnalisarPlantaResult {
    const clean = text
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean) as Record<string, unknown>;
    } catch {
      this.logger.error(`JSON inválido na resposta IA: ${clean.slice(0, 300)}`);
      return RESULTADO_VAZIO('Resposta da IA inválida. Crie o croqui manualmente.');
    }

    return {
      eixos_x:    (parsed['eixos_x'] as string[])            ?? [],
      eixos_y:    (parsed['eixos_y'] as string[])            ?? [],
      elementos:  (parsed['elementos'] as ElementoCroqui[])  ?? [],
      confianca:  typeof parsed['confianca'] === 'number' ? parsed['confianca'] : 0,
      observacoes: (parsed['observacoes'] as string | null)  ?? null,
      tokens_in:  0,
      tokens_out: 0,
    };
  }

  // ── Validação de magic bytes (imagem) ─────────────────────────────────────

  private validarImagem(base64: string, mimeType: string): void {
    const buf = Buffer.from(base64.slice(0, 16), 'base64');

    if (mimeType === 'image/jpeg') {
      if (buf[0] !== 0xff || buf[1] !== 0xd8) {
        throw new BadRequestException(
          'Arquivo não é uma imagem válida (JPEG, PNG) ou PDF',
        );
      }
    } else if (mimeType === 'image/png') {
      if (
        buf[0] !== 0x89 || buf[1] !== 0x50 ||
        buf[2] !== 0x4e || buf[3] !== 0x47
      ) {
        throw new BadRequestException(
          'Arquivo não é uma imagem válida (JPEG, PNG) ou PDF',
        );
      }
    } else if (mimeType === 'application/pdf') {
      if (
        buf[0] !== 0x25 || buf[1] !== 0x50 ||
        buf[2] !== 0x44 || buf[3] !== 0x46
      ) {
        throw new BadRequestException(
          'Arquivo não é uma imagem válida (JPEG, PNG) ou PDF',
        );
      }
    }
  }

  // ── Método principal ──────────────────────────────────────────────────────

  async analisar(
    tenantId: number,
    userId: number,
    dto: AnalisarPlantaDto,
  ): Promise<AnalisarPlantaResult> {
    // 1. Graceful disable
    if (!this.anthropic) {
      this.logger.debug('ANTHROPIC_API_KEY não configurada — retornando mock');
      return RESULTADO_VAZIO(
        'Análise por IA indisponível. Crie o croqui manualmente.',
      );
    }

    // 2. Rate limit
    await this.checkRateLimit(userId);

    // 3. Validar magic bytes
    this.validarImagem(dto.arquivo_base64, dto.mime_type);

    // 4. Chamar Claude
    const { text, tokensIn, tokensOut, duracaoMs } =
      await this.callClaude(dto);

    // 5. Parse
    const parsed = this.parseResposta(text);

    // 6. Confiança baixa: sinaliza sempre que abaixo do mínimo
    if (parsed.confianca < CONFIANCA_MINIMA) {
      parsed.observacoes =
        parsed.elementos.length === 0
          ? 'Não foi possível identificar elementos estruturais com confiança suficiente. Crie o croqui manualmente.'
          : `Confiança baixa (${Math.round(parsed.confianca * 100)}%). Revise todos os elementos antes de salvar.`;
    }

    // 7. logUsage — fire-and-forget
    this.logUsage(tenantId, userId, tokensIn, tokensOut, duracaoMs);

    return { ...parsed, tokens_in: tokensIn, tokens_out: tokensOut };
  }
}
