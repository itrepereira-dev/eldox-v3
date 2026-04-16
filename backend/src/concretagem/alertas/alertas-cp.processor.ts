// backend/src/concretagem/alertas/alertas-cp.processor.ts
import { Processor, Process, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { AlertasCpService } from './alertas-cp.service';

@Processor('concretagem-alertas')
export class AlertasCpProcessor implements OnModuleInit {
  private readonly logger = new Logger(AlertasCpProcessor.name);

  constructor(
    private readonly alertasCpService: AlertasCpService,
    @InjectQueue('concretagem-alertas') private readonly queue: Queue,
  ) {}

  /**
   * Registra o job cron diário às 8h na inicialização do módulo.
   * Remove jobs repetíveis obsoletos antes de registrar novo.
   */
  async onModuleInit(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'verificar-ruptura-cp') {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    await this.queue.add(
      'verificar-ruptura-cp',
      {},
      {
        repeat: { cron: '0 8 * * *' },
        timeout: 120_000,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('Job cron "verificar-ruptura-cp" registrado (0 8 * * *)');
  }

  @Process('verificar-ruptura-cp')
  async handleVerificarRupturaCp(_job: Job<void>): Promise<void> {
    await this.alertasCpService.verificarRupturasCps();
  }
}
