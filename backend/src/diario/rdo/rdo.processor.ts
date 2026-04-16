// backend/src/diario/rdo/rdo.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { RdoIaService } from './rdo-ia.service';
import { RdoPdfService } from './rdo-pdf.service';
import { AgenteCampo } from '../../ai/agents/rdo/agente-campo';
import type {
  JobAcionarAgentesIa,
  JobGerarResumoIa,
  JobGerarPdf,
  JobEnviarAlerta,
} from './types/rdo.types';

type DiarioJobData =
  | { name: 'acionar-agentes-ia'; data: JobAcionarAgentesIa }
  | { name: 'gerar-resumo-ia'; data: JobGerarResumoIa }
  | { name: 'gerar-pdf'; data: JobGerarPdf }
  | { name: 'enviar-alerta'; data: JobEnviarAlerta };

@Processor('diario')
export class RdoProcessor {
  private readonly logger = new Logger(RdoProcessor.name);

  constructor(
    private readonly rdoIaService: RdoIaService,
    private readonly rdoPdfService: RdoPdfService,
    private readonly agenteCampo: AgenteCampo,
  ) {}

  @Process()
  async process(job: Job<any>): Promise<any> {
    const start = Date.now();

    this.logger.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date(),
        action: `diario.job.${job.name}`,
        job_id: job.id,
        attempt: job.attemptsMade,
        data: job.data,
      }),
    );

    try {
      switch (job.name) {
        case 'acionar-agentes-ia':
          return await this.handleAcionarAgentesIa(job.data as JobAcionarAgentesIa);

        case 'gerar-resumo-ia':
          return await this.handleGerarResumoIa(job.data as JobGerarResumoIa);

        case 'gerar-pdf':
          return await this.handleGerarPdf(job.data as JobGerarPdf);

        case 'enviar-alerta':
          return await this.handleEnviarAlerta(job.data as JobEnviarAlerta);

        case 'agente-campo':
          return await this.handleAgenteCampo(job.data);

        default:
          throw new Error(`Job desconhecido na fila diario: ${job.name}`);
      }
    } finally {
      const ms = Date.now() - start;
      this.logger.log(
        JSON.stringify({
          level: 'info',
          action: `diario.job.${job.name}.concluido`,
          job_id: job.id,
          ms,
        }),
      );
    }
  }

  // ─── Handlers de Jobs ─────────────────────────────────────────────────────

  /**
   * Job: acionar-agentes-ia
   * Executa AGENTE-CLIMA + AGENTE-EQUIPE + AGENTE-ATIVIDADES em paralelo
   * logo após a criação do RDO.
   */
  private async handleAcionarAgentesIa(data: JobAcionarAgentesIa): Promise<void> {
    const { rdoId, tenantId } = data;

    await this.rdoIaService.acionarAgentesIniciais(rdoId, tenantId);

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'diario.job.acionar_agentes_ia.ok',
        rdo_id: rdoId,
        tenant_id: tenantId,
      }),
    );
  }

  /**
   * Job: gerar-resumo-ia
   * Aciona AGENTE-RESUMO após aprovação do RDO.
   * Salva resultado em rdos.resumo_ia.
   */
  private async handleGerarResumoIa(data: JobGerarResumoIa): Promise<void> {
    const { rdoId, tenantId } = data;

    const resumo = await this.rdoIaService.gerarResumo(rdoId, tenantId);

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'diario.job.gerar_resumo_ia.ok',
        rdo_id: rdoId,
        tenant_id: tenantId,
        resumo_gerado: resumo.length > 0,
      }),
    );
  }

  /**
   * Job: gerar-pdf
   * Gera o PDF do RDO aprovado via PDFKit e faz upload para MinIO.
   * Salva o path em rdos.pdf_path após upload.
   */
  private async handleGerarPdf(data: JobGerarPdf): Promise<void> {
    const { rdoId, tenantId } = data;

    await this.rdoPdfService.gerarPdf(rdoId, tenantId);

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'diario.job.gerar_pdf.ok',
        rdo_id: rdoId,
      }),
    );
  }

  /**
   * Job: agente-campo
   * Processa mensagem WhatsApp via AGENTE-CAMPO e cria rascunho de RDO.
   */
  private async handleAgenteCampo(data: any): Promise<void> {
    const { tenantId, usuarioId, numero, mensagem, fotos_base64, obra_id } = data;

    if (!tenantId || !usuarioId) {
      this.logger.warn(JSON.stringify({ action: 'diario.job.agente_campo.sem_tenant', numero }));
      return;
    }

    const resultado = await this.agenteCampo.executar({
      tenant_id: tenantId,
      usuario_id: usuarioId,
      obra_id: obra_id ?? 0,
      numero_whatsapp: numero ?? '',
      mensagem_texto: mensagem ?? '',
      fotos_base64: fotos_base64 ?? [],
    });

    this.logger.log(JSON.stringify({
      level: 'info',
      action: 'diario.job.agente_campo.ok',
      tenant_id: tenantId,
      acao: resultado.acao,
      rdo_id: resultado.rdo_id,
      resumo: resultado.resumo_para_usuario?.slice(0, 80),
    }));
  }

  /**
   * Job: enviar-alerta
   * Envia alertas de obras sem RDO, atrasos ou ocorrências críticas.
   */
  private async handleEnviarAlerta(data: JobEnviarAlerta): Promise<void> {
    const { tenantId, tipo, obras_afetadas } = data;

    // TODO: implementar envio de alertas
    // Canais: email, push notification, WhatsApp (via AGENTE-CAMPO)
    // 1. Buscar usuários da obra (engenheiros e admins)
    // 2. Formatar mensagem por canal
    // 3. Despachar para serviço de notificação

    this.logger.log(
      JSON.stringify({
        level: 'info',
        action: 'diario.job.enviar_alerta',
        tenant_id: tenantId,
        tipo,
        obras_afetadas,
      }),
    );
  }
}
