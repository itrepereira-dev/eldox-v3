// backend/src/almoxarifado/sinapi/sinapi.controller.ts
import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SinapiService } from './sinapi.service';
@Controller('api/v1/almoxarifado/sinapi')
export class SinapiController {
  constructor(private readonly sinapi: SinapiService) {}

  /**
   * POST /almoxarifado/sinapi/importar
   * Upload da planilha SINAPI mensal (xlsx da CAIXA).
   */
  @Post('importar')
  @UseInterceptors(FileInterceptor('arquivo'))
  async importar(
    @UploadedFile() file: Express.Multer.File,
    @Body('uf') uf: string,
    @Body('referencia_mes') referenciaMes: string,
    @Body('desonerado') desoneradoStr: string,
  ) {
    const desonerado = desoneradoStr === 'true' || desoneradoStr === '1';
    const result = await this.sinapi.importarXlsx(file.buffer, uf, referenciaMes, desonerado);
    return { status: 'success', data: result };
  }

  /**
   * GET /almoxarifado/sinapi/buscar?uf=SP&q=tinta&tipo=INSUMO
   */
  @Get('buscar')
  async buscar(
    @Query('uf') uf: string,
    @Query('q') q?: string,
    @Query('referencia_mes') referenciaMes?: string,
    @Query('tipo') tipo?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const result = await this.sinapi.buscar({ uf, q, referenciaMes, tipo, limit, offset });
    return { status: 'success', data: result };
  }

  /**
   * GET /almoxarifado/sinapi/meses?uf=SP
   */
  @Get('meses')
  async meses(@Query('uf') uf = 'SP') {
    const data = await this.sinapi.listarMeses(uf);
    return { status: 'success', data };
  }

  /**
   * GET /almoxarifado/sinapi/ufs
   */
  @Get('ufs')
  async ufs() {
    const data = await this.sinapi.listarUfs();
    return { status: 'success', data };
  }
}
