// backend/src/concretagem/croqui/croqui.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CroquiController } from './croqui.controller';
import { CroquiService } from './croqui.service';
import { PlantaIaService } from './planta-ia.service';

@Module({
  imports: [ConfigModule],
  controllers: [CroquiController],
  providers: [CroquiService, PlantaIaService],
  exports: [CroquiService],
})
export class CroquiModule {}
