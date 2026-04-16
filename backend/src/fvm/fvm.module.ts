// backend/src/fvm/fvm.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GedModule } from '../ged/ged.module';
import { CatalogoFvmService } from './catalogo/catalogo.service';
import { CatalogoFvmController } from './catalogo/catalogo.controller';
import { FornecedoresService } from './fornecedores/fornecedores.service';
import { FornecedoresController } from './fornecedores/fornecedores.controller';
import { RecebimentoService } from './recebimento/recebimento.service';
import { RecebimentoController } from './recebimento/recebimento.controller';
import { EvidenciasService } from './recebimento/evidencias/evidencias.service';
import { EvidenciasController } from './recebimento/evidencias/evidencias.controller';
import { EnsaiosService } from './recebimento/ensaios/ensaios.service';
import { EnsaiosController } from './recebimento/ensaios/ensaios.controller';

@Module({
  imports: [PrismaModule, GedModule],
  providers: [CatalogoFvmService, FornecedoresService, RecebimentoService, EvidenciasService, EnsaiosService],
  controllers: [CatalogoFvmController, FornecedoresController, RecebimentoController, EvidenciasController, EnsaiosController],
  exports: [CatalogoFvmService, FornecedoresService, RecebimentoService, EvidenciasService, EnsaiosService],
})
export class FvmModule {}
