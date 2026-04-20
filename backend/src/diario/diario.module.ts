// backend/src/diario/diario.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { IaModule } from '../ia/ia.module';
import { GedModule } from '../ged/ged.module';
import { AprovacoesModule } from '../aprovacoes/aprovacoes.module';
import { RdoController } from './rdo/rdo.controller';
import { RdoClienteController } from './rdo/rdo-cliente.controller';
import { RdoService } from './rdo/rdo.service';
import { RdoIaService } from './rdo/rdo-ia.service';
import { RdoPdfService } from './rdo/rdo-pdf.service';
import { RdoFotosService } from './rdo/rdo-fotos.service';
import { RdoExportService } from './rdo/rdo-export.service';
import { RdoAvancoService } from './rdo/rdo-avanco.service';
import { RdoProcessor } from './rdo/rdo.processor';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { AgenteValidador } from '../ai/agents/rdo/agente-validador';
import { AgenteResumo } from '../ai/agents/rdo/agente-resumo';
import { AgenteAlerta } from '../ai/agents/rdo/agente-alerta';
import { AgenteCampo } from '../ai/agents/rdo/agente-campo';

@Module({
  imports: [
    PrismaModule,
    IaModule,
    // GedModule — exportado GedService/MinioService, usado pelo RdoFotosService
    // para roteamento de upload de fotos via GED (Agent A, 2026-04-20).
    GedModule,
    // AprovacoesModule — exportado AprovacoesService, usado pelo RdoService
    // para solicitar aprovação quando RDO vai para status "revisao" e para
    // consumir eventos APROVACAO_DECIDIDA via @OnEvent (Agent A, 2026-04-20).
    AprovacoesModule,
    BullModule.registerQueue({
      name: 'diario',
      // Configuração de Redis via variável de ambiente REDIS_URL
      // defaultJobOptions são herdados da config global em app.module.ts
    }),
  ],
  controllers: [RdoController, RdoClienteController, WhatsappController],
  providers: [
    RdoService,
    RdoIaService,
    RdoPdfService,
    RdoFotosService,
    RdoExportService,
    RdoAvancoService,
    RdoProcessor,
    WhatsappService,
    AgenteValidador,
    AgenteResumo,
    AgenteAlerta,
    AgenteCampo,
  ],
  exports: [RdoService, RdoIaService, RdoPdfService, RdoFotosService, RdoExportService, RdoAvancoService],
})
export class DiarioModule {}
