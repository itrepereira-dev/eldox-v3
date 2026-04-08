import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogoService } from './catalogo/catalogo.service';
import { CatalogoController } from './catalogo/catalogo.controller';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  providers: [CatalogoService],
  controllers: [CatalogoController],
  exports: [CatalogoService],
})
export class FvsModule {}
