import { Module } from '@nestjs/common';
import { PerfisAcessoController } from './perfis-acesso.controller';
import { PerfisAcessoService } from './perfis-acesso.service';

@Module({
  controllers: [PerfisAcessoController],
  providers: [PerfisAcessoService],
})
export class PerfisAcessoModule {}
