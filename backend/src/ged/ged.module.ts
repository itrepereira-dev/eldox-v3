// src/ged/ged.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GedService } from './ged.service';
import { GedController } from './ged.controller';
import { GedPastasService } from './pastas/pastas.service';
import { WorkflowService } from './workflow/workflow.service';
import { MinioService } from './storage/minio.service';
import { GedOcrWorker } from './workers/ged-ocr.worker';
import { GedClassifierWorker } from './workers/ged-classifier.worker';
// PrismaModule é @Global() — PrismaService está disponível globalmente sem importação explícita

@Module({
  imports: [
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
    GedPastasService,
    WorkflowService,
    MinioService,
    GedOcrWorker,
    GedClassifierWorker,
  ],
  controllers: [GedController],
  // GedService exportado para uso em outros módulos (FVS, NCs, Transmittals)
  exports: [GedService],
})
export class GedModule {}
