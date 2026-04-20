// src/ged/workers/ged-classifier.worker.ts
//
// Worker de Classificação IA do GED.
//
// Responsabilidade: dado `ocr_texto` já preenchido, chama Claude Sonnet pra
// classificar o documento (categorias, disciplina, confiança, entidades) e
// popula `ai_categorias`, `ai_confianca`, `ai_metadata`.
//
// Estratégia de retry: se `ocr_texto` ainda estiver null ou muito curto
// (<20 chars), re-enfileira após 60s. Desiste depois de 5 tentativas.

import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { IaService } from '../../ia/ia.service';

interface ClassifyJobData {
  versaoId: number;
  tenantId: number;
}

interface VersaoClassify {
  id: number;
  ocr_texto: string | null;
  titulo: string;
  codigo: string;
  disciplina: string | null;
  categoria_atual: string | null;
}

interface ClaudeClassificacao {
  categorias_sugeridas?: string[];
  disciplina_sugerida?: string | null;
  confianca?: number;
  resumo?: string;
  entidades?: {
    numeroDocumento?: string | null;
    data?: string | null;
    obraNome?: string | null;
  };
}

const MAX_RETRIES_OCR_PENDENTE = 5;
const MAX_TEXTO_PROMPT = 12_000; // ~3k tokens de input pra Sonnet

@Processor('ged')
export class GedClassifierWorker {
  private readonly logger = new Logger(GedClassifierWorker.name);
  private readonly gedQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @InjectQueue('ged') gedQueue: any,
  ) {
    this.gedQueue = gedQueue as Queue;
  }

  // concurrency=1: Claude Sonnet é o modelo caro — processar serialmente
  @Process({ name: 'ged.classify', concurrency: 1 })
  async handle(job: Job<ClassifyJobData>): Promise<void> {
    const { versaoId, tenantId } = job.data;
    this.logger.log(`[CLASSIFY] Iniciando versaoId=${versaoId} tenant=${tenantId}`);

    const rows = await this.prisma.$queryRawUnsafe<VersaoClassify[]>(
      `SELECT v.id,
              v.ocr_texto,
              d.titulo,
              d.codigo,
              d.disciplina,
              c.nome AS categoria_atual
         FROM ged_versoes v
         JOIN ged_documentos d ON d.id = v.documento_id
         LEFT JOIN ged_categorias c ON c.id = d.categoria_id
        WHERE v.id = $1 AND v.tenant_id = $2`,
      versaoId,
      tenantId,
    );

    if (!rows.length) {
      this.logger.warn(`[CLASSIFY] versaoId=${versaoId} não encontrada.`);
      return;
    }

    const versao = rows[0];
    const textoOk = versao.ocr_texto && versao.ocr_texto !== 'OCR_PENDENTE' && versao.ocr_texto.trim().length >= 20;

    if (!textoOk) {
      // Re-enfileirar se ainda der; job.attemptsMade começa em 1 na primeira execução
      const tentativas = job.attemptsMade ?? 0;
      if (tentativas < MAX_RETRIES_OCR_PENDENTE) {
        this.logger.warn(
          `[CLASSIFY] OCR indisponível (tentativa ${tentativas + 1}/${MAX_RETRIES_OCR_PENDENTE}) — re-enfileirando em 60s versaoId=${versaoId}`,
        );
        throw new Error('OCR ainda não disponível para classificação.');
      }
      this.logger.warn(`[CLASSIFY] Desistindo após ${tentativas} tentativas — versaoId=${versaoId}`);
      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes
            SET ai_categorias = $1,
                ai_confianca  = 0.0,
                ai_metadata   = COALESCE(ai_metadata, '{}'::jsonb) || $2::jsonb
          WHERE id = $3`,
        ['SEM_TEXTO_OCR'],
        JSON.stringify({ classify: { error: 'ocr_texto_indisponivel', tentativas } }),
        versaoId,
      );
      return;
    }

    const textoTruncado = versao.ocr_texto!.length > MAX_TEXTO_PROMPT
      ? versao.ocr_texto!.slice(0, MAX_TEXTO_PROMPT)
      : versao.ocr_texto!;

    try {
      const resultado = await this.classificarViaClaude(
        tenantId,
        versao.titulo,
        versao.codigo,
        versao.disciplina,
        versao.categoria_atual,
        textoTruncado,
      );

      const categorias = Array.isArray(resultado.categorias_sugeridas) && resultado.categorias_sugeridas.length
        ? resultado.categorias_sugeridas.slice(0, 5).map(String)
        : ['NAO_CLASSIFICADO'];
      const confianca = typeof resultado.confianca === 'number'
        ? Math.max(0, Math.min(1, resultado.confianca))
        : 0.0;

      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes
            SET ai_categorias = $1,
                ai_confianca  = $2,
                ai_metadata   = COALESCE(ai_metadata, '{}'::jsonb) || $3::jsonb
          WHERE id = $4`,
        categorias,
        confianca,
        JSON.stringify({
          classify: {
            disciplina_sugerida: resultado.disciplina_sugerida ?? null,
            resumo: resultado.resumo ?? null,
            entidades: resultado.entidades ?? {},
            processado_em: new Date().toISOString(),
            modelo: 'claude-sonnet-4-6',
          },
        }),
        versaoId,
      );

      this.logger.log(
        `[CLASSIFY] OK versaoId=${versaoId} categorias=${categorias.join('|')} confianca=${confianca}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[CLASSIFY] Falha versaoId=${versaoId}: ${msg}`);
      // Grava o erro em metadata mas não re-throw — classificação é best-effort
      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes
            SET ai_metadata = COALESCE(ai_metadata, '{}'::jsonb) || $1::jsonb
          WHERE id = $2`,
        JSON.stringify({ classify: { error: msg, processado_em: new Date().toISOString() } }),
        versaoId,
      );
    }
  }

  // ── Chamada Claude com prompt estruturado ──────────────────────────────────

  private async classificarViaClaude(
    tenantId: number,
    titulo: string,
    codigo: string,
    disciplina: string | null,
    categoriaAtual: string | null,
    texto: string,
  ): Promise<ClaudeClassificacao> {
    const system = `Você é um classificador de documentos técnicos de obra (construção civil).
Analise o título, código e trecho de texto extraído e retorne APENAS JSON válido, sem markdown, sem comentários.

Formato estrito:
{
  "categorias_sugeridas": ["string", ...],
  "disciplina_sugerida": "ARQ"|"EST"|"HID"|"ELE"|"MEC"|"GEO"|"LAB"|"GER"|null,
  "confianca": 0.0,
  "resumo": "string (1 frase)",
  "entidades": {
    "numeroDocumento": "string|null",
    "data": "YYYY-MM-DD|null",
    "obraNome": "string|null"
  }
}

Categorias típicas: "Planta Arquitetônica", "Planta Estrutural", "Planta Hidráulica", "Planta Elétrica", "Memorial Descritivo", "Memorial de Cálculo", "Relatório de Ensaio", "Laudo Técnico", "Contrato", "Nota Fiscal", "Especificação Técnica", "Certidão", "ART/RRT", "Alvará", "Cronograma", "Orçamento", "Check-list de FVS", "Procedimento", "Registro de Qualidade".

Disciplinas: ARQ=Arquitetura, EST=Estrutural, HID=Hidráulico, ELE=Elétrico, MEC=Mecânico/HVAC, GEO=Geotécnico, LAB=Laboratório/Ensaios, GER=Geral/Administrativo.

A confiança deve refletir a certeza da classificação (0.0-1.0).`;

    const user = `Título: ${titulo}
Código: ${codigo}
Disciplina atual (pode ser null): ${disciplina ?? 'null'}
Categoria atual (pode ser null): ${categoriaAtual ?? 'null'}

Trecho extraído do documento (truncado se longo):
"""
${texto}
"""

Retorne o JSON de classificação agora.`;

    const { text, tokensIn, tokensOut, custoEstimado } = await this.ia.callClaudeForWorker(
      'claude-sonnet-4-6',
      system,
      user,
      800,
      tenantId,
      'ged.classify',
      60_000,
    );

    this.logger.log(
      `[CLASSIFY-IA] tokensIn=${tokensIn} tokensOut=${tokensOut} custo=$${custoEstimado.toFixed(5)}`,
    );

    // Remove fences de markdown se o modelo insistir
    const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Resposta do Claude não contém JSON: ${clean.slice(0, 120)}`);
    }
    const parsed = JSON.parse(match[0]) as ClaudeClassificacao;
    return parsed;
  }
}
