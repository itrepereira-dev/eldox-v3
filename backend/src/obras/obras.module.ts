import { Module } from '@nestjs/common';
import { ObrasController } from './obras.controller';
import { ObrasService } from './obras.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FvsModule } from '../fvs/fvs.module';
import { GedModule } from '../ged/ged.module';
import { GenericaStrategy } from './strategies/generica.strategy';
import { EdificacaoStrategy } from './strategies/edificacao.strategy';
import { LinearStrategy } from './strategies/linear.strategy';
import { InstalacaoStrategy } from './strategies/instalacao.strategy';

@Module({
  imports: [PrismaModule, FvsModule, GedModule],
  controllers: [ObrasController],
  providers: [ObrasService, GenericaStrategy, EdificacaoStrategy, LinearStrategy, InstalacaoStrategy],
  exports: [ObrasService],
})
export class ObrasModule {}
