// backend/src/ncs/ncs.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NcsService } from './ncs.service';
import { NcsController } from './ncs.controller';

@Module({
  imports: [PrismaModule],
  providers: [NcsService],
  controllers: [NcsController],
  exports: [NcsService],
})
export class NcsModule {}
