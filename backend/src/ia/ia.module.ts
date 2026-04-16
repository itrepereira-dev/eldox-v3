import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IaService } from './ia.service';
import { IaController } from './ia.controller';
import { AgenteController } from './agente.controller';

@Module({
  imports: [PrismaModule],
  providers: [IaService],
  controllers: [IaController, AgenteController],
  exports: [IaService],
})
export class IaModule {}
