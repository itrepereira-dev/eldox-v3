import { Module } from '@nestjs/common';
import { ObrasController } from './obras.controller';
import { ObrasService } from './obras.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FvsModule } from '../fvs/fvs.module';

@Module({
  imports: [PrismaModule, FvsModule],
  controllers: [ObrasController],
  providers: [ObrasService],
  exports: [ObrasService],
})
export class ObrasModule {}
