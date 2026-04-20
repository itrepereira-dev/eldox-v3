// backend/src/almoxarifado/sinapi/sinapi.controller.ts
import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SinapiService } from './sinapi.service';

// Planilha SINAPI oficial (CAIXA) pode passar de 30 MB. Limite 50 MB.
const SINAPI_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@Controller('api/v1/almoxarifado/sinapi')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SinapiController {
  constructor(private readonly sinapi: SinapiService) {}

  /**
   * POST /almoxarifado/sinapi/importar
   * Upload da planilha SINAPI mensal (xlsx da CAIXA).
   * Apenas SUPER_ADMIN (dado compartilhado entre tenants).
   */
  @Post('importar')
  @Roles('SUPER_ADMIN')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: SINAPI_MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        const name = file.originalname?.toLowerCase() ?? '';
        const ok =
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          name.endsWith('.xlsx') ||
          name.endsWith('.xls');
        cb(
          ok
            ? null
            : new BadRequestException('Planilha SINAPI precisa ser .xlsx'),
          ok,
        );
      },
    }),
  )
  async importar(
    @UploadedFile() file: Express.Multer.File,
    @Body('uf') uf: string,
    @Body('referencia_mes') referenciaMes: string,
    @Body('desonerado') desoneradoStr: string,
  ) {
    if (!file) {
      throw new PayloadTooLargeException('Arquivo obrigatório');
    }
    if (file.size > SINAPI_MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(
        `Arquivo acima do limite de ${SINAPI_MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
      );
    }
    const desonerado = desoneradoStr === 'true' || desoneradoStr === '1';
    const result = await this.sinapi.importarXlsx(
      file.buffer,
      uf,
      referenciaMes,
      desonerado,
    );
    return { status: 'success', data: result };
  }

  /**
   * GET /almoxarifado/sinapi/buscar?uf=SP&q=tinta&tipo=INSUMO
   */
  @Get('buscar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE', 'SUPER_ADMIN')
  async buscar(
    @Query('uf') uf: string,
    @Query('q') q?: string,
    @Query('referencia_mes') referenciaMes?: string,
    @Query('tipo') tipo?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const result = await this.sinapi.buscar({
      uf,
      q,
      referenciaMes,
      tipo,
      limit,
      offset,
    });
    return { status: 'success', data: result };
  }

  /**
   * GET /almoxarifado/sinapi/meses?uf=SP
   */
  @Get('meses')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE', 'SUPER_ADMIN')
  async meses(@Query('uf') uf = 'SP') {
    const data = await this.sinapi.listarMeses(uf);
    return { status: 'success', data };
  }

  /**
   * GET /almoxarifado/sinapi/ufs
   */
  @Get('ufs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE', 'SUPER_ADMIN')
  async ufs() {
    const data = await this.sinapi.listarUfs();
    return { status: 'success', data };
  }
}
