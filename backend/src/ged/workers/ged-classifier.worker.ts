// src/ged/workers/ged-classifier.worker.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

interface ClassifyJobData {
  versaoId: number;
  tenantId: number;
}

interface VersaoOcr {
  id: number;
  ocr_texto: string | null;
}

@Processor('ged')
export class GedClassifierWorker {
  private readonly logger = new Logger(GedClassifierWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('ged.classify')
  async handle(job: Job<ClassifyJobData>): Promise<void> {
    const { versaoId, tenantId } = job.data;

    this.logger.log(`[CLASSIFY] Iniciando job versaoId=${versaoId} tenantId=${tenantId}`);

    try {
      // Busca o texto OCR extraído
      const rows = await this.prisma.$queryRawUnsafe<VersaoOcr[]>(
        `SELECT id, ocr_texto FROM ged_versoes WHERE id = $1`,
        versaoId,
      );

      if (!rows.length) {
        this.logger.warn(`[CLASSIFY] Versão ${versaoId} não encontrada. Job ignorado.`);
        return;
      }

      const versao = rows[0];

      if (!versao.ocr_texto || versao.ocr_texto === 'OCR_PENDENTE') {
        this.logger.warn(
          `[CLASSIFY] OCR ainda não concluído para versaoId=${versaoId}. Será re-enfileirado.`,
        );
        // Lança erro para Bull fazer retry com backoff
        throw new Error('OCR ainda não disponível para classificação.');
      }

      // Placeholder: classificação IA via Anthropic (a ser integrado na fase IA)
      // Future: chamar Anthropic Claude com o texto OCR para categorizar disciplina,
      // extrair metadados (número do projeto, revisão, data), calcular confiança
      //
      // Exemplo futuro:
      // const resultado = await this.anthropicService.classificar(versao.ocr_texto);
      // await this.prisma.$executeRawUnsafe(
      //   `UPDATE ged_versoes
      //    SET ai_categorias = $1::jsonb, ai_confianca = $2, ai_metadata = $3::jsonb
      //    WHERE id = $4`,
      //   JSON.stringify(resultado.categorias),
      //   resultado.confianca,
      //   JSON.stringify(resultado.metadata),
      //   versaoId,
      // );

      // Por enquanto, grava metadados placeholder
      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_versoes
         SET ai_categorias = $1::jsonb,
             ai_confianca  = $2,
             ai_metadata   = $3::jsonb
         WHERE id = $4`,
        JSON.stringify(['PENDENTE_INTEGRACAO_IA']),
        0.0,
        JSON.stringify({ status: 'AGUARDANDO_ANTHROPIC_INTEGRATION' }),
        versaoId,
      );

      this.logger.log(`[CLASSIFY] Classificação placeholder gravada: versaoId=${versaoId}`);
    } catch (err) {
      this.logger.error(`[CLASSIFY] Erro na classificação: versaoId=${versaoId}`, err);
      throw err;
    }
  }
}
