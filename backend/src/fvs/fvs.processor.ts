// backend/src/fvs/fvs.processor.ts
// Processor de jobs agendados FVS: relatório semanal + priorização diária
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, Process } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { AgenteRelatorioFvs } from '../ai/agents/fvs/agente-relatorio-fvs';
import { AgentePriorizacaoInspecao } from '../ai/agents/fvs/agente-priorizacao-inspecao';
import { PrismaService } from '../prisma/prisma.service';

// usuario_id = 0 indica execução automática via cron (sem usuário humano)
const CRON_USUARIO_ID = 0;

@Injectable()
@Processor('fvs-jobs')
export class FvsProcessor implements OnModuleInit {
  private readonly logger = new Logger(FvsProcessor.name);

  constructor(
    @InjectQueue('fvs-jobs') private readonly fvsQueue: Queue,
    private readonly agenteRelatorio: AgenteRelatorioFvs,
    private readonly agentePriorizacao: AgentePriorizacaoInspecao,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove jobs repetíveis antigos para evitar duplicatas
    const jobs = await this.fvsQueue.getRepeatableJobs();
    for (const job of jobs) {
      if (job.name === 'relatorio-semanal' || job.name === 'priorizacao-diaria') {
        await this.fvsQueue.removeRepeatableByKey(job.key);
      }
    }

    // Relatório semanal — segunda-feira às 6h
    await this.fvsQueue.add(
      'relatorio-semanal',
      {},
      {
        repeat: { cron: '0 6 * * 1' },
        timeout: 300_000,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    // Priorização diária — todo dia às 5h45
    await this.fvsQueue.add(
      'priorizacao-diaria',
      {},
      {
        repeat: { cron: '45 5 * * *' },
        timeout: 180_000,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      'FVS cron jobs registrados: relatório semanal (seg 6h) + priorização diária (5h45)',
    );
  }

  @Process('relatorio-semanal')
  async handleRelatorioSemanal(_job: Job<void>): Promise<void> {
    this.logger.log('Iniciando geração de relatórios semanais FVS...');
    try {
      // Busca todas as obras com fichas ativas na última semana
      const obras = await this.prisma.$queryRaw<
        { tenant_id: number; obra_id: number; obra_nome: string }[]
      >`
        SELECT DISTINCT f.tenant_id, f.obra_id, o.nome AS obra_nome
        FROM fvs_fichas f
        JOIN "Obra" o ON o.id = f.obra_id
        WHERE f.deleted_at IS NULL
          AND f.status IN ('em_inspecao', 'concluida')
      `;

      const hoje = new Date();
      const semana_fim = hoje.toISOString().slice(0, 10);
      const semana_inicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      let sucesso = 0;
      for (const { tenant_id, obra_id, obra_nome } of obras) {
        try {
          await this.agenteRelatorio.executar({
            tenant_id,
            usuario_id: CRON_USUARIO_ID,
            obra_id,
            obra_nome,
            semana_inicio,
            semana_fim,
          });
          sucesso++;
        } catch (err) {
          this.logger.error(
            `Erro ao gerar relatório para tenant=${tenant_id} obra=${obra_id}:`,
            err,
          );
        }
      }

      this.logger.log(
        `Relatórios gerados: ${sucesso}/${obras.length} obra(s) (semana ${semana_inicio} → ${semana_fim})`,
      );
    } catch (err) {
      this.logger.error('Erro no job relatorio-semanal:', err);
    }
  }

  @Process('priorizacao-diaria')
  async handlePriorizacaoDiaria(_job: Job<void>): Promise<void> {
    this.logger.log('Iniciando priorização diária de inspeções FVS...');
    try {
      // Busca todas as obras com fichas em inspeção ativa
      const obras = await this.prisma.$queryRaw<
        { tenant_id: number; obra_id: number }[]
      >`
        SELECT DISTINCT tenant_id, obra_id
        FROM fvs_fichas
        WHERE deleted_at IS NULL
          AND status IN ('rascunho', 'em_inspecao')
      `;

      let sucesso = 0;
      for (const { tenant_id, obra_id } of obras) {
        try {
          await this.agentePriorizacao.executar({
            tenant_id,
            usuario_id: CRON_USUARIO_ID,
            obra_id,
          });
          sucesso++;
        } catch (err) {
          this.logger.error(
            `Erro ao priorizar inspeções para tenant=${tenant_id} obra=${obra_id}:`,
            err,
          );
        }
      }

      this.logger.log(`Priorização concluída: ${sucesso}/${obras.length} obra(s)`);
    } catch (err) {
      this.logger.error('Erro no job priorizacao-diaria:', err);
    }
  }
}
