import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { GedModule } from '../ged/ged.module';
import { CatalogoService } from './catalogo/catalogo.service';
import { CatalogoController } from './catalogo/catalogo.controller';
import { InspecaoService } from './inspecao/inspecao.service';
import { InspecaoController } from './inspecao/inspecao.controller';

@Module({
  imports: [
    PrismaModule,
    GedModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para fotos
    }),
  ],
  providers: [CatalogoService, InspecaoService],
  controllers: [CatalogoController, InspecaoController],
  exports: [CatalogoService, InspecaoService],
})
export class FvsModule {}
