// src/ged/ged.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GedService } from './ged.service';
import { GedExportService } from './ged-export.service';
import { GedController } from './ged.controller';
import { GedPastasService } from './pastas/pastas.service';
import { WorkflowService } from './workflow/workflow.service';
import { MinioService } from './storage/minio.service';
import { GedOcrWorker } from './workers/ged-ocr.worker';
import { GedClassifierWorker } from './workers/ged-classifier.worker';
import { GedThumbnailWorker } from './workers/ged-thumbnail.worker';
import { IaModule } from '../ia/ia.module';
// PrismaModule é @Global() — PrismaService está disponível globalmente sem importação explícita

@Module({
  imports: [
    // IaService injetado nos workers OCR/Classifier pra chamar Claude API
    IaModule,
    // Fila Bull para jobs de OCR e classificação IA
    BullModule.registerQueue({
      name: 'ged',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),

    // Multer com memoryStorage para acessar file.buffer no serviço antes de enviar ao MinIO
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        // Limite de 100 MB por arquivo
        fileSize: 100 * 1024 * 1024,
      },
    }),
  ],
  providers: [
    GedService,
    GedExportService,
    GedPastasService,
    WorkflowService,
    MinioService,
    GedOcrWorker,
    GedClassifierWorker,
    GedThumbnailWorker,
  ],
  controllers: [GedController],
  // GedService e MinioService exportados para uso em outros módulos (FVS, NCs, Transmittals, Ensaios)
  exports: [GedService, MinioService],
})
export class GedModule {}
