import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EfetivoService } from './efetivo.service';
import { EfetivoController } from './efetivo.controller';
import { CadastrosService } from './cadastros/cadastros.service';
import { CadastrosController } from './cadastros/cadastros.controller';
import { EfetivoToolsService } from './ia/tools/efetivo.tools';
import { SuggesterAgent } from './ia/agents/suggester.agent';
import { AnalystAgent } from './ia/agents/analyst.agent';
import { AlerterAgent } from './ia/agents/alerter.agent';
import { EfetivoIaService } from './ia/efetivo-ia.service';
import { EfetivoIaController } from './ia/efetivo-ia.controller';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    BullModule.registerQueue({ name: 'efetivo-analise' }),
  ],
  providers: [
    EfetivoService,
    CadastrosService,
    EfetivoToolsService,
    SuggesterAgent,
    AnalystAgent,
    AlerterAgent,
    EfetivoIaService,
  ],
  controllers: [EfetivoController, CadastrosController, EfetivoIaController],
  exports: [EfetivoService, CadastrosService, EfetivoIaService, AnalystAgent, AlerterAgent],
})
export class EfetivoModule {}
