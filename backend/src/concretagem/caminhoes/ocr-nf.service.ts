// backend/src/concretagem/caminhoes/ocr-nf.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';

export interface OcrNfResult {
  numero_nf: string | null;
  data_emissao_nf: string | null; // YYYY-MM-DD
  volume: number | null;
  motorista: string | null;
  placa: string | null;
  fornecedor_nome: string | null;
  fck: number | null;
  traco: string | null;
  confianca: number; // 0-100
  raw_text: string;
}

@Injectable()
export class OcrNfService {
  private readonly logger = new Logger(OcrNfService.name);
  private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(private readonly prisma: PrismaService) {}

  async extrairDadosNf(
    tenantId: number,
    userId: number,
    imageBase64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  ): Promise<OcrNfResult> {
    const inicio = Date.now();
    const modelo = 'claude-sonnet-4-6';

    // Rate limit check: max 20 calls/hour per user
    const countRows = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM ai_usage_log
       WHERE tenant_id = $1 AND usuario_id = $2 AND handler = 'ocr_nf'
         AND criado_em > NOW() - INTERVAL '1 hour'`,
      tenantId, userId,
    );
    if (parseInt(countRows[0].count) >= 20) {
      throw new Error('Rate limit: máximo 20 leituras de NF por hora');
    }

    const prompt = `Você é um sistema de OCR especializado em notas fiscais de concreto usinado brasileiro.

Analise a imagem da nota fiscal (DANFE ou NF-e de usina de concreto) e extraia os seguintes campos em JSON:

{
  "numero_nf": "número da NF (apenas dígitos e traços)",
  "data_emissao_nf": "data de emissão no formato YYYY-MM-DD",
  "volume": "volume em m³ como número decimal",
  "motorista": "nome do motorista se presente",
  "placa": "placa do veículo (formato AAA-0000 ou AAA0A00)",
  "fornecedor_nome": "nome da concreteira/usina emissora",
  "fck": "resistência do concreto em MPa como número inteiro",
  "traco": "traço ou tipo do concreto (ex: C25, FCK 25 Bombeado)",
  "confianca": "sua confiança na extração de 0 a 100"
}

Se um campo não estiver visível ou legível, use null. Responda APENAS com o JSON, sem explicações.`;

    const response = await this.anthropic.messages.create({
      model: modelo,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const durMs = Date.now() - inicio;
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const custo = (tokensIn / 1000) * 0.003 + (tokensOut / 1000) * 0.015;

    // Log usage
    this.prisma.$executeRawUnsafe(
      `INSERT INTO ai_usage_log (tenant_id, usuario_id, handler, modelo, tokens_in, tokens_out, custo_estimado, duracao_ms)
       VALUES ($1,$2,'ocr_nf',$3,$4,$5,$6,$7)`,
      tenantId, userId, modelo, tokensIn, tokensOut, custo, durMs,
    ).catch((e: unknown) => this.logger.error(`ai_usage_log falhou: ${e}`));

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        numero_nf: (parsed.numero_nf as string) ?? null,
        data_emissao_nf: (parsed.data_emissao_nf as string) ?? null,
        volume: parsed.volume != null ? Number(parsed.volume) : null,
        motorista: (parsed.motorista as string) ?? null,
        placa: (parsed.placa as string) ?? null,
        fornecedor_nome: (parsed.fornecedor_nome as string) ?? null,
        fck: parsed.fck != null ? parseInt(String(parsed.fck)) : null,
        traco: (parsed.traco as string) ?? null,
        confianca: parsed.confianca != null ? Number(parsed.confianca) : 50,
        raw_text: rawText,
      };
    } catch {
      return {
        numero_nf: null, data_emissao_nf: null, volume: null,
        motorista: null, placa: null, fornecedor_nome: null,
        fck: null, traco: null, confianca: 0, raw_text: rawText,
      };
    }
  }
}
