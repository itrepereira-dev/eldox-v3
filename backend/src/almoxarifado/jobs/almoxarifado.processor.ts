// backend/src/almoxarifado/jobs/almoxarifado.processor.ts
import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { NfeService } from '../nfe/nfe.service';
import { NfeMatchService } from '../nfe/nfe-match.service';
import { AgenteReorderService } from '../ia/agente-reorder.service';
import { AgenteAnomaliaService } from '../ia/agente-anomalia.service';
import { EstoqueService } from '../estoque/estoque.service';
import { InsightsService } from '../ia/insights.service';

/**
 * Processor da fila BullMQ "almoxarifado".
 *
 * IMPORTANTE — Bull v4 / @nestjs/bull:
 *   • @Process() sem argumento só consome jobs ADICIONADOS SEM NOME
 *     (ex: queue.add(data) — sem string como 1º argumento).
 *   • Jobs nomeados (queue.add('meu-job', data)) precisam de
 *     @Process('meu-job') específico, senão falham com
 *     "Missing process handler for job type meu-job".
 *
 * Cada handler abaixo é registrado com seu nome exato — espelha os nomes
 * usados em queue.add() pelos services.
 */
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

  // ─── Wrapper de logs/telemetria ──────────────────────────────────────────

  private async withLog<T>(job: Job, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.logger.log(JSON.stringify({
      action: `alm.job.${job.name}`,
      job_id: job.id,
      attempt: job.attemptsMade,
    }));
    try {
      const result = await fn();
      this.logger.log(JSON.stringify({
        action: `alm.job.${job.name}.done`,
        job_id: job.id,
        duration_ms: Date.now() - start,
      }));
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(JSON.stringify({
        action: `alm.job.${job.name}.error`,
        job_id: job.id,
        error: message,
        duration_ms: Date.now() - start,
      }));
      throw err;
    }
  }

  // ─── Handlers por nome de job ────────────────────────────────────────────

  @Process('processar-nfe')
  async processarNfe(job: Job<{ webhookId: number }>) {
    return this.withLog(job, async () => {
      await this.nfeService.processarWebhook(job.data.webhookId);
    });
  }

  @Process('match-nfe-itens')
  async matchNfeItens(job: Job<{ nfeId: number; tenantId: number }>) {
    return this.withLog(job, async () => {
      await this.nfeMatchService.matchItens(job.data.nfeId, job.data.tenantId);
    });
  }

  @Process('verificar-estoque-min')
  async verificarEstoqueMin(job: Job<{ tenantId: number; obraId: number }>) {
    return this.withLog(job, async () => {
      const alertas = await this.estoqueService.getAlertas(job.data.tenantId, job.data.obraId);
      this.logger.log(JSON.stringify({
        action:   'alm.verificar-estoque-min.done',
        tenantId: job.data.tenantId,
        obraId:   job.data.obraId,
        alertas:  alertas.length,
      }));
    });
  }

  @Process('previsao-reposicao')
  async previsaoReposicao(job: Job<{ tenantId: number; localId: number }>) {
    return this.withLog(job, async () => {
      const predictions = await this.reorderService.executar(job.data.tenantId, job.data.localId);
      this.logger.log(JSON.stringify({
        action:   'alm.reorder.done',
        tenantId: job.data.tenantId,
        localId:  job.data.localId,
        itens:    predictions.length,
      }));
    });
  }

  @Process('detectar-anomalias')
  async detectarAnomalias(job: Job<{ tenantId: number; localId: number }>) {
    return this.withLog(job, async () => {
      const anomalias = await this.anomaliaService.executar(job.data.tenantId, job.data.localId);
      this.logger.log(JSON.stringify({
        action:   'alm.anomalia.done',
        tenantId: job.data.tenantId,
        localId:  job.data.localId,
        itens:    anomalias.length,
      }));
    });
  }

  @Process('gerar-insights')
  async gerarInsights(job: Job<{ tenantId?: number }>) {
    return this.withLog(job, async () => {
      if (job.data.tenantId) {
        // Acionado via reanalisar (tenant específico)
        await this.insightsService.executarParaTenant(job.data.tenantId);
      } else {
        // Acionado via cron (todos os tenants)
        await this.insightsService.executarParaTodos();
      }
    });
  }

  @Process('gerar-pdf-oc')
  async gerarPdfOc(job: Job<{ ocId: number }>) {
    return this.withLog(job, async () => {
      // TODO — OcPdfService.gerar(job.data.ocId)
      this.logger.log(`[gerar-pdf-oc] ocId=${job.data.ocId} — pendente`);
    });
  }

  @Process('notificar-fornecedor')
  async notificarFornecedor(job: Job<{ ocId: number }>) {
    return this.withLog(job, async () => {
      // TODO — EmailService.notificarFornecedor(job.data.ocId)
      this.logger.log(`[notificar-fornecedor] ocId=${job.data.ocId} — pendente`);
    });
  }
}
