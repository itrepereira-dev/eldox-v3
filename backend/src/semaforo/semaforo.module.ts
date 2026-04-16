// backend/src/semaforo/semaforo.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SemaforoService } from './semaforo.service';
import { SemaforoController } from './semaforo.controller';

@Module({
  imports: [PrismaModule],
  providers: [SemaforoService],
  controllers: [SemaforoController],
  exports: [SemaforoService],
})
export class SemaforoModule {}
