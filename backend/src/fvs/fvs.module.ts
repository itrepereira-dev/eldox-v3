import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { GedModule } from '../ged/ged.module';
import { IaModule } from '../ia/ia.module';
import { CatalogoService } from './catalogo/catalogo.service';
import { CatalogoController } from './catalogo/catalogo.controller';
import { ModeloService } from './modelos/modelo.service';
import { ModeloController } from './modelos/modelo.controller';
import { InspecaoService } from './inspecao/inspecao.service';
import { InspecaoController } from './inspecao/inspecao.controller';
import { RoService } from './inspecao/ro.service';
import { RoController } from './inspecao/ro.controller';
import { ParecerService } from './inspecao/parecer.service';
import { FvsDashboardService } from './dashboard/fvs-dashboard.service';
import { FvsDashboardController } from './dashboard/fvs-dashboard.controller';
import { FvsClienteController } from './cliente/fvs-cliente.controller';
import { AgenteDiagnosticoNc } from '../ai/agents/fvs/agente-diagnostico-nc';
import { AgentePreditorNc } from '../ai/agents/fvs/agente-preditor-nc';
import { AgenteAnaliseFoto } from '../ai/agents/fvs/agente-analise-foto';
import { AgenteRelatorioFvs } from '../ai/agents/fvs/agente-relatorio-fvs';
import { AgentePriorizacaoInspecao } from '../ai/agents/fvs/agente-priorizacao-inspecao';
import { FvsPdfService } from './pdf/fvs-pdf.service';
import { FvsProcessor } from './fvs.processor';

@Module({
  imports: [
    PrismaModule,
    GedModule,
    IaModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para fotos
    }),
    BullModule.registerQueue({ name: 'fvs-jobs' }),
  ],
  providers: [
    CatalogoService, ModeloService, InspecaoService, RoService, ParecerService,
    FvsDashboardService, FvsPdfService,
    AgenteDiagnosticoNc, AgentePreditorNc, AgenteAnaliseFoto,
    AgenteRelatorioFvs, AgentePriorizacaoInspecao,
    FvsProcessor,
  ],
  controllers: [
    CatalogoController, ModeloController, InspecaoController, RoController,
    FvsDashboardController, FvsClienteController,
  ],
  exports: [
    CatalogoService, ModeloService, InspecaoService, RoService, ParecerService,
    FvsDashboardService, FvsPdfService,
  ],
})
export class FvsModule {}
