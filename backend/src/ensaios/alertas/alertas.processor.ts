// backend/src/ensaios/alertas/alertas.processor.ts
import { Processor, Process, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { AlertasService } from './alertas.service';

@Processor('ensaios-alertas')
export class AlertasProcessor implements OnModuleInit {
  private readonly logger = new Logger(AlertasProcessor.name);

  constructor(
    private readonly alertasService: AlertasService,
    @InjectQueue('ensaios-alertas') private readonly queue: Queue,
  ) {}

  /**
   * Registra o job cron recorrente na inicialização.
   * Bull mantém o job mesmo entre restarts via Redis.
   */
  async onModuleInit(): Promise<void> {
    // Remove jobs repetíveis antigos para evitar duplicatas
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'verificar-proximos-cupons') {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    await this.queue.add(
      'verificar-proximos-cupons',
      {},
      {
        repeat: { cron: '0 7 * * *' },
        timeout: 120_000,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('Job cron "verificar-proximos-cupons" registrado (0 7 * * *)');
  }

  @Process('verificar-proximos-cupons')
  async handleVerificarProximosCupons(_job: Job<void>): Promise<void> {
    await this.alertasService.verificarProximosCupons();
  }

  /**
   * Compatibilidade com o job individual agendado pelo EnsaiosService
   * quando um novo ensaio é criado (jobId=ensaio-alerta-{id}).
   */
  @Process('alerta-proximo-cupom')
  async handleAlertaProximoCupom(
    job: Job<{ ensaioId: number; tenantId: number; proximoEnsaioData: string }>,
  ): Promise<void> {
    this.logger.log(`Alerta de próximo cupom para ensaio ${job.data.ensaioId}`);
    // Reutiliza o loop geral — vai encontrar apenas este ensaio (já que o job
    // é disparado quando ainda tem delay, a data já estará próxima)
    await this.alertasService.verificarProximosCupons();
  }
}
