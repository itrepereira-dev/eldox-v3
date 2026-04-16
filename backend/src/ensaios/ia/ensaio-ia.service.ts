// backend/src/ensaios/ia/ensaio-ia.service.ts
// EnsaioIaService — extração de laudos de ensaio via Claude
import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { BetaBase64PDFSource, BetaRequestDocumentBlock, BetaTextBlockParam, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { PrismaService } from '../../prisma/prisma.service';
import type { ExtrairLaudoIaDto, TipoDisponivel } from './dto/extrair-laudo-ia.dto';

const MODELO = 'claude-haiku-4-5-20251001';
const HANDLER = 'ensaios.extrairLaudo';
const RATE_LIMIT = 20;

const COST_PER_1K = { in: 0.00025, out: 0.00125 };

export interface ResultadoExtraido {
  tipo_id: number | null;       // matched tipo_id ou null se não encontrado
  tipo_nome_extraido: string;
  valor_obtido: number;
  unidade: string;
}

export interface ExtrairLaudoResult {
  data_ensaio: string | null;
  resultados: ResultadoExtraido[];
  observacoes: string | null;
  confianca: number;            // 0.0–1.0
  tokens_in: number;
  tokens_out: number;
}

@Injectable()
export class EnsaioIaService {
  private readonly logger = new Logger(EnsaioIaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ── Rate limit ─────────────────────────────────────────────────────────────

  private async checkRateLimit(userId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ count: string | number }[]>(
      `SELECT COUNT(*)::int AS count
       FROM ai_usage_log
       WHERE handler_name = $1
         AND usuario_id   = $2
         AND created_at  >= NOW() - INTERVAL '1 hour'`,
      HANDLER,
      userId,
    );
    const used = Number(rows[0]?.count ?? 0);
    if (used >= RATE_LIMIT) {
      throw new HttpException(
        `Limite de ${RATE_LIMIT} chamadas/hora atingido para ${HANDLER}`,
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
    const custo = (tokensIn / 1000) * COST_PER_1K.in + (tokensOut / 1000) * COST_PER_1K.out;
    this.prisma
      .$executeRawUnsafe(
        `INSERT INTO ai_usage_log
           (tenant_id, usuario_id, handler_name, modelo, tokens_in, tokens_out, custo_estimado, duracao_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        tenantId,
        userId,
        HANDLER,
        MODELO,
        tokensIn,
        tokensOut,
        custo,
        duracaoMs,
      )
      .catch((err: unknown) => {
        this.logger.error(`logUsage falhou: ${String(err)}`);
      });
  }

  // ── Build prompt ──────────────────────────────────────────────────────────

  private buildPrompt(tipos: TipoDisponivel[]): string {
    const tiposJson = JSON.stringify(
      tipos.map((t) => ({ id: t.id, nome: t.nome, unidade: t.unidade })),
    );
    return `Analise o laudo laboratorial anexado e extraia as informações solicitadas.

Tipos de ensaio disponíveis para correspondência:
${tiposJson}

Instrução:
- Identifique a data do ensaio no laudo (formato YYYY-MM-DD). Se não encontrar, use null.
- Para cada resultado de ensaio presente no laudo, tente corresponder ao tipo disponível mais adequado pelo nome.
  Se encontrar correspondência, preencha "tipo_id" com o id do tipo. Se não encontrar, use null.
- Extraia o valor numérico obtido e a unidade de medida para cada resultado.
- Inclua observações gerais relevantes do laudo, ou null se não houver.
- Informe sua confiança na extração como número entre 0.0 e 1.0.

Retorne APENAS o seguinte JSON válido, sem markdown, sem texto adicional:
{
  "data_ensaio": "YYYY-MM-DD ou null",
  "resultados": [
    {
      "tipo_id": <int ou null>,
      "tipo_nome_extraido": "<nome como aparece no laudo>",
      "valor_obtido": <number>,
      "unidade": "<unidade>"
    }
  ],
  "observacoes": "<string ou null>",
  "confianca": <0.0 a 1.0>
}`;
  }

  // ── Chamada ao Claude com document block (PDF) ────────────────────────────

  private async callClaude(dto: ExtrairLaudoIaDto): Promise<{
    text: string;
    tokensIn: number;
    tokensOut: number;
    duracaoMs: number;
  }> {
    // Chamador garante que apiKey existe (checado em extrairLaudo)
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY')!;
    const anthropic = new Anthropic({ apiKey });

    const system =
      'Você é especialista em análise de laudos laboratoriais na construção civil. ' +
      'Extraia os dados do laudo e retorne APENAS JSON válido, sem markdown, sem explicações.';

    const pdfSource: BetaBase64PDFSource = {
      type: 'base64',
      media_type: 'application/pdf',
      data: dto.arquivo_base64,
    };

    const documentBlock: BetaRequestDocumentBlock = {
      type: 'document',
      source: pdfSource,
    };

    const textBlock: BetaTextBlockParam = {
      type: 'text',
      text: this.buildPrompt(dto.tipos_disponiveis),
    };

    const userMessage: BetaMessageParam = {
      role: 'user',
      content: [documentBlock, textBlock],
    };

    const inicio = Date.now();
    const response = await anthropic.beta.messages.create({
      model: MODELO,
      max_tokens: 1024,
      system,
      messages: [userMessage],
      betas: ['pdfs-2024-09-25'],
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

  // ── Parse da resposta JSON ────────────────────────────────────────────────

  private parseResposta(text: string): ExtrairLaudoResult {
    // Remove possível markdown code fence
    const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean) as Record<string, unknown>;
    } catch {
      this.logger.error(`JSON inválido na resposta IA: ${clean.slice(0, 300)}`);
      throw new BadRequestException('Resposta da IA não é JSON válido. Tente novamente.');
    }

    return {
      data_ensaio: (parsed['data_ensaio'] as string | null) ?? null,
      resultados: (parsed['resultados'] as ResultadoExtraido[]) ?? [],
      observacoes: (parsed['observacoes'] as string | null) ?? null,
      confianca: typeof parsed['confianca'] === 'number' ? parsed['confianca'] : 0,
      tokens_in: 0,   // será preenchido pelo chamador
      tokens_out: 0,  // será preenchido pelo chamador
    };
  }

  // ── Método principal ──────────────────────────────────────────────────────

  async extrairLaudo(
    tenantId: number,
    userId: number,
    dto: ExtrairLaudoIaDto,
  ): Promise<ExtrairLaudoResult> {
    // 1. Rate limit
    await this.checkRateLimit(userId);

    // 2. Validar magic bytes: %PDF = 0x25 0x50 0x44 0x46
    const buf = Buffer.from(dto.arquivo_base64, 'base64');
    if (
      buf.length < 4 ||
      buf[0] !== 0x25 ||
      buf[1] !== 0x50 ||
      buf[2] !== 0x44 ||
      buf[3] !== 0x46
    ) {
      throw new BadRequestException('Arquivo não é um PDF válido');
    }

    // 3. Chamar Claude (mock se API key ausente)
    let text: string;
    let tokensIn = 0;
    let tokensOut = 0;
    let duracaoMs = 0;

    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.logger.debug('ANTHROPIC_API_KEY não configurada — retornando mock result');
      return {
        data_ensaio: null,
        resultados: [],
        observacoes: null,
        confianca: 0,
        tokens_in: 0,
        tokens_out: 0,
      };
    }

    try {
      const resultado = await this.callClaude(dto);
      text = resultado.text;
      tokensIn = resultado.tokensIn;
      tokensOut = resultado.tokensOut;
      duracaoMs = resultado.duracaoMs;
    } catch (err) {
      if (
        err instanceof HttpException ||
        err instanceof BadRequestException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      throw new InternalServerErrorException('Erro ao chamar API de IA');
    }

    // 4. Parse do JSON
    const parsed = this.parseResposta(text);

    // 5. logUsage — fire-and-forget
    this.logUsage(tenantId, userId, tokensIn, tokensOut, duracaoMs);

    // 6. Retornar resultado com tokens
    return {
      ...parsed,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    };
  }
}
