// backend/src/concretagem/concretagem.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { CroquiModule } from './croqui/croqui.module';

// Concretagens
import { ConcrtagensService } from './concretagens/concretagens.service';
import { ConcrtagensController } from './concretagens/concretagens.controller';
import { EmailConcrtagemService } from './concretagens/email-concretagem.service';
import { PortalFornecedorService } from './concretagens/portal-fornecedor.service';
import { PortalFornecedorController } from './concretagens/portal-fornecedor.controller';

// Caminhões
import { CaminhoesService } from './caminhoes/caminhoes.service';
import { CaminhoesController } from './caminhoes/caminhoes.controller';
import { OcrNfService } from './caminhoes/ocr-nf.service';

// Corpos de Prova
import { CpsService } from './corpos-de-prova/cps.service';
import { CpsController } from './corpos-de-prova/cps.controller';

// Alertas CP (BullMQ)
import { AlertasCpService } from './alertas/alertas-cp.service';
import { AlertasCpProcessor } from './alertas/alertas-cp.processor';

// Dashboard
import { DashboardConcretagemService } from './dashboard/dashboard.service';
import { DashboardConcretagemController } from './dashboard/dashboard.controller';

// Laudos de Laboratório
import { LaudosService } from './laudos/laudos.service';
import { LaudosController } from './laudos/laudos.controller';

// RACs (Relatório de Ação Corretiva)
import { RacsService } from './racs/racs.service';
import { RacsController } from './racs/racs.controller';

@Module({
  imports: [
    PrismaModule,
    CroquiModule,
    BullModule.registerQueue({ name: 'concretagem-alertas' }),
  ],
  providers: [
    ConcrtagensService,
    EmailConcrtagemService,
    CaminhoesService,
    OcrNfService,
    CpsService,
    AlertasCpService,
    AlertasCpProcessor,
    DashboardConcretagemService,
    LaudosService,
    RacsService,
    PortalFornecedorService,
  ],
  controllers: [
    ConcrtagensController,
    CaminhoesController,
    CpsController,
    DashboardConcretagemController,
    LaudosController,
    RacsController,
    PortalFornecedorController,
  ],
  exports: [
    CroquiModule,
    ConcrtagensService,
    CaminhoesService,
    CpsService,
    DashboardConcretagemService,
    LaudosService,
    RacsService,
  ],
})
export class ConcretagemModule {}
