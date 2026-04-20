// backend/src/ncs/ncs.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GedModule } from '../ged/ged.module';
import { NcsService } from './ncs.service';
import { NcEvidenciaService } from './nc-evidencia.service';
import { NcsController } from './ncs.controller';

@Module({
  imports: [PrismaModule, GedModule],
  providers: [NcsService, NcEvidenciaService],
  controllers: [NcsController],
  exports: [NcsService],
})
export class NcsModule {}
