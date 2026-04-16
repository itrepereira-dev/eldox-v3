// backend/src/ensaios/ensaios.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { GedModule } from '../ged/ged.module';
import { FvmModule } from '../fvm/fvm.module';
import { TiposService } from './tipos/tipos.service';
import { TiposController } from './tipos/tipos.controller';
import { LaboratoriosService } from './laboratorios/laboratorios.service';
import { LaboratoriosController } from './laboratorios/laboratorios.controller';
import { RevisoesService } from './revisoes/revisoes.service';
import { RevisoesController } from './revisoes/revisoes.controller';
import { EnsaiosService } from './ensaios.service';
import { EnsaiosController } from './ensaios.controller';
import { EvolutionService } from './whatsapp/evolution.service';
import { AlertasService } from './alertas/alertas.service';
import { AlertasProcessor } from './alertas/alertas.processor';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { EnsaioIaService } from './ia/ensaio-ia.service';
import { EnsaioIaController } from './ia/ensaio-ia.controller';

@Module({
  imports: [
    PrismaModule,
    GedModule,    // exporta GedService e MinioService
    FvmModule,    // exporta RecebimentoService (usado por RevisoesService)
    BullModule.registerQueue({ name: 'ensaios' }),
    BullModule.registerQueue({ name: 'ensaios-alertas' }),
  ],
  // AlertasService deve aparecer ANTES de RevisoesService (dependência)
  providers: [
    TiposService,
    LaboratoriosService,
    EvolutionService,
    AlertasService,
    AlertasProcessor,
    RevisoesService,
    EnsaiosService,
    DashboardService,
    EnsaioIaService,
  ],
  // RevisoesController ANTES de EnsaiosController: evita que GET /ensaios/:id
  // capture "revisoes" como parâmetro dinâmico
  controllers: [TiposController, LaboratoriosController, RevisoesController, EnsaiosController, DashboardController, EnsaioIaController],
  exports: [TiposService, AlertasService, RevisoesService, EnsaiosService],
})
export class EnsaiosModule {}
