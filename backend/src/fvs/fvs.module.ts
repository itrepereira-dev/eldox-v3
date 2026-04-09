import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { GedModule } from '../ged/ged.module';
import { CatalogoService } from './catalogo/catalogo.service';
import { CatalogoController } from './catalogo/catalogo.controller';
import { ModeloService } from './modelos/modelo.service';
import { ModeloController } from './modelos/modelo.controller';
import { InspecaoService } from './inspecao/inspecao.service';
import { InspecaoController } from './inspecao/inspecao.controller';
import { RoService } from './inspecao/ro.service';
import { RoController } from './inspecao/ro.controller';
import { ParecerService } from './inspecao/parecer.service';

@Module({
  imports: [
    PrismaModule,
    GedModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para fotos
    }),
  ],
  providers: [CatalogoService, ModeloService, InspecaoService, RoService, ParecerService],
  controllers: [CatalogoController, ModeloController, InspecaoController, RoController],
  exports: [CatalogoService, ModeloService, InspecaoService, RoService, ParecerService],
})
export class FvsModule {}
