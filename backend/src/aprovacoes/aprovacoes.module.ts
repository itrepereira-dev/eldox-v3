import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { AprovacoesController } from './aprovacoes.controller';
import { AprovacoesService } from './aprovacoes.service';
import { WorkflowTemplatesController } from './templates/workflow-templates.controller';
import { WorkflowTemplatesService } from './templates/workflow-templates.service';
import { AprovacoesNotifierService } from './aprovacoes-notifier.service';
import { EscalacaoProcessor } from './escalacao.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'aprovacoes-escalacao' }),
  ],
  controllers: [AprovacoesController, WorkflowTemplatesController],
  providers: [
    AprovacoesService,
    WorkflowTemplatesService,
    AprovacoesNotifierService,
    EscalacaoProcessor,
  ],
  exports: [AprovacoesService],
})
export class AprovacoesModule {}
