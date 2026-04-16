// backend/src/planos-acao/planos-acao.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigPlanosAcaoService } from './config/config.service';
import { ConfigController } from './config/config.controller';
import { PaService } from './pa/pa.service';
import { PaController } from './pa/pa.controller';

@Module({
  imports: [PrismaModule],
  providers: [ConfigPlanosAcaoService, PaService],
  controllers: [ConfigController, PaController],
  exports: [PaService],
})
export class PlanosAcaoModule {}
