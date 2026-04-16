import { Processor, Process, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AprovacoesNotifierService } from './aprovacoes-notifier.service';

interface EscalacaoRow {
  id: number;
  tenant_id: number;
  etapa_atual: number;
  created_at: Date;
  prazo_horas: number;
  acao_vencimento: string;
}

@Processor('aprovacoes-escalacao')
@Injectable()
export class EscalacaoProcessor implements OnModuleInit {
  private readonly logger = new Logger(EscalacaoProcessor.name);

  constructor(
    @InjectQueue('aprovacoes-escalacao') private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly notifier: AprovacoesNotifierService,
  ) {}

  async onModuleInit() {
    // Remove jobs repetidos anteriores e cria novo
    await this.queue.removeRepeatable('escalacao-check', {
      cron: '0 * * * *',
    });
    await this.queue.add(
      'escalacao-check',
      {},
      {
        repeat: { cron: '0 * * * *' },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('Job de escalação agendado (a cada hora)');
  }

  @Process('escalacao-check')
  async handleEscalacao(_job: Job) {
    this.logger.log('Executando verificação de escalação...');

    // Busca instâncias EM_APROVACAO que ultrapassaram o prazo e ainda não escalaram
    const instancias = await this.prisma.$queryRaw<EscalacaoRow[]>`
      SELECT ai.id, ai.tenant_id, ai.etapa_atual, ai.created_at,
             wte.prazo_horas, wte.acao_vencimento
      FROM aprovacao_instancias ai
      JOIN workflow_template_etapas wte
        ON wte.template_id = ai.template_id AND wte.ordem = ai.etapa_atual
      WHERE ai.status = 'EM_APROVACAO'
        AND ai.alerta_escalacao_enviado = false
        AND ai.deleted_at IS NULL
        AND ai.created_at < NOW() - (wte.prazo_horas || ' hours')::interval
    `;

    for (const inst of instancias) {
      try {
        if (inst.acao_vencimento === 'ESCALAR') {
          await this.prisma.aprovacaoInstancia.update({
            where: { id: inst.id },
            data: { alertaEscalacaoEnviado: true },
          });
          await this.prisma.aprovacaoDecisao.create({
            data: {
              tenantId: inst.tenant_id,
              instanciaId: inst.id,
              etapaOrdem: inst.etapa_atual,
              usuarioId: 0,
              decisao: 'ESCALADO',
              observacao: `Prazo de ${inst.prazo_horas}h excedido`,
            },
          });
          await this.notifier.notificarEscalacao(inst.tenant_id, inst.id);
        } else if (inst.acao_vencimento === 'AVANCAR') {
          // Aprovação tácita — registra e avança
          await this.prisma.aprovacaoDecisao.create({
            data: {
              tenantId: inst.tenant_id,
              instanciaId: inst.id,
              etapaOrdem: inst.etapa_atual,
              usuarioId: 0,
              decisao: 'AVANCADO_TACITO',
              observacao: `Aprovação tácita após ${inst.prazo_horas}h`,
            },
          });
          // TODO: chamar AprovacoesService.avancarEtapa() quando refatorado para método público
        } else if (inst.acao_vencimento === 'BLOQUEAR') {
          await this.prisma.aprovacaoInstancia.update({
            where: { id: inst.id },
            data: {
              status: 'REPROVADO',
              alertaEscalacaoEnviado: true,
            },
          });
          await this.notifier.notificarEscalacao(inst.tenant_id, inst.id);
        }
      } catch (err: unknown) {
        this.logger.error(
          `Erro ao processar escalação da instância ${inst.id}`,
          err,
        );
      }
    }

    this.logger.log(
      `Verificação de escalação concluída. Instâncias processadas: ${instancias.length}`,
    );
  }
}
