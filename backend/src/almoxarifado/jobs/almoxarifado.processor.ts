// backend/src/almoxarifado/jobs/almoxarifado.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { NfeService } from '../nfe/nfe.service';
import { NfeMatchService } from '../nfe/nfe-match.service';
import { AgenteReorderService } from '../ia/agente-reorder.service';
import { AgenteAnomaliaService } from '../ia/agente-anomalia.service';
import { EstoqueService } from '../estoque/estoque.service';
import { InsightsService } from '../ia/insights.service';

@Processor('almoxarifado')
export class AlmoxarifadoProcessor implements OnModuleInit {
  private readonly logger = new Logger(AlmoxarifadoProcessor.name);

  constructor(
    private readonly nfeService:      NfeService,
    private readonly nfeMatchService: NfeMatchService,
    private readonly reorderService:  AgenteReorderService,
    private readonly anomaliaService: AgenteAnomaliaService,
    private readonly estoqueService:  EstoqueService,
    private readonly insightsService: InsightsService,
    @InjectQueue('almoxarifado') private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove jobs repetíveis antigos para evitar duplicatas
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'gerar-insights') {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    // Registra cron: a cada 6 horas (0 */6 * * *)
    await this.queue.add(
      'gerar-insights',
      {},
      {
        repeat: { cron: '0 */6 * * *' },
        timeout: 300_000,  // 5 min max
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log('Job cron "gerar-insights" registrado (0 */6 * * *)');
  }

  @Process()
  async process(job: Job<any>): Promise<any> {
    const start = Date.now();

    this.logger.log(JSON.stringify({
      action: `alm.job.${job.name}`,
      job_id: job.id,
      attempt: job.attemptsMade,
    }));

    try {
      let result: any;

      switch (job.name) {
        case 'processar-nfe':
          result = await this.handleProcessarNfe(job.data);
          break;

        case 'match-nfe-itens':
          result = await this.handleMatchNfeItens(job.data);
          break;

        case 'verificar-estoque-min':
          result = await this.handleVerificarEstoqueMin(job.data);
          break;

        case 'previsao-reposicao':
          result = await this.handlePrevisaoReposicao(job.data);
          break;

        case 'detectar-anomalias':
          result = await this.handleDetectarAnomalias(job.data);
          break;

        case 'gerar-insights':
          result = await this.handleGerarInsights(job.data);
          break;

        case 'gerar-pdf-oc':
          result = await this.handleGerarPdfOc(job.data);
          break;

        case 'notificar-fornecedor':
          result = await this.handleNotificarFornecedor(job.data);
          break;

        default:
          this.logger.warn(`Job desconhecido: ${job.name}`);
          return;
      }

      this.logger.log(JSON.stringify({
        action: `alm.job.${job.name}.done`,
        job_id: job.id,
        duration_ms: Date.now() - start,
      }));

      return result;

    } catch (err: any) {
      this.logger.error(JSON.stringify({
        action: `alm.job.${job.name}.error`,
        job_id: job.id,
        error: err?.message,
        duration_ms: Date.now() - start,
      }));
      throw err;
    }
  }

  // ── Sprint 4: NF-e ────────────────────────────────────────────────────────

  private async handleProcessarNfe(data: { webhookId: number }) {
    await this.nfeService.processarWebhook(data.webhookId);
  }

  private async handleMatchNfeItens(data: { nfeId: number; tenantId: number }) {
    await this.nfeMatchService.matchItens(data.nfeId, data.tenantId);
  }

  // ── Sprint 5: pendente ────────────────────────────────────────────────────

  private async handleVerificarEstoqueMin(data: { tenantId: number; obraId: number }) {
    // Verifica alertas de estoque mínimo via query direta (sem IA)
    const alertas = await this.estoqueService.getAlertas(data.tenantId, data.obraId);
    this.logger.log(JSON.stringify({
      action:   'alm.verificar-estoque-min.done',
      tenantId: data.tenantId,
      obraId:   data.obraId,
      alertas:  alertas.length,
    }));
  }

  private async handlePrevisaoReposicao(data: { tenantId: number; localId: number }) {
    const predictions = await this.reorderService.executar(data.tenantId, data.localId);
    this.logger.log(JSON.stringify({
      action:   'alm.reorder.done',
      tenantId: data.tenantId,
      localId:  data.localId,
      itens:    predictions.length,
    }));
  }

  private async handleDetectarAnomalias(data: { tenantId: number; localId: number }) {
    const anomalias = await this.anomaliaService.executar(data.tenantId, data.localId);
    this.logger.log(JSON.stringify({
      action:   'alm.anomalia.done',
      tenantId: data.tenantId,
      localId:  data.localId,
      itens:    anomalias.length,
    }));
  }

  private async handleGerarPdfOc(data: any) {
    // TODO — OcPdfService.gerar(data.ocId)
    this.logger.log(`[gerar-pdf-oc] ocId=${data.ocId} — pendente`);
  }

  private async handleNotificarFornecedor(data: any) {
    // TODO — EmailService.notificarFornecedor(data.ocId)
    this.logger.log(`[notificar-fornecedor] ocId=${data.ocId} — pendente`);
  }

  private async handleGerarInsights(data: { tenantId?: number }) {
    if (data.tenantId) {
      // Acionado via reanalisar (tenant específico)
      await this.insightsService.executarParaTenant(data.tenantId);
    } else {
      // Acionado via cron (todos os tenants)
      await this.insightsService.executarParaTodos();
    }
  }
}
