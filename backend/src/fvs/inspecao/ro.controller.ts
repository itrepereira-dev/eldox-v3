// backend/src/fvs/inspecao/ro.controller.ts
import {
  Controller, Get, Patch, Post, Delete, Body, Param,
  ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, Ip,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { RoService } from './ro.service';
import { PatchRoDto } from './dto/patch-ro.dto';
import { PatchServicoNcDto } from './dto/patch-servico-nc.dto';

interface JwtUser { sub: number; tenantId: number; role: string }

@Controller('api/v1/fvs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoController {
  constructor(private readonly ro: RoService) {}

  @Get('fichas/:fichaId/ro')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRo(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
  ) {
    return this.ro.getRo(tenantId, fichaId);
  }

  @Patch('fichas/:fichaId/ro')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  patchRo(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Body() dto: PatchRoDto,
  ) {
    return this.ro.patchRo(tenantId, fichaId, dto);
  }

  @Patch('fichas/:fichaId/ro/servicos/:servicoNcId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  patchServicoNc(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoNcId', ParseIntPipe) servicoNcId: number,
    @Body() dto: PatchServicoNcDto,
    @Ip() ip: string,
  ) {
    return this.ro.patchServicoNc(tenantId, fichaId, servicoNcId, dto, user.sub, ip);
  }

  @Post('fichas/:fichaId/ro/servicos/:servicoNcId/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 10 * 1024 * 1024 } }))
  createRoEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoNcId', ParseIntPipe) servicoNcId: number,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    const descricao = undefined; // pode adicionar @Body('descricao') depois se necessário
    return this.ro.createRoEvidencia(tenantId, fichaId, servicoNcId, user.sub, file, descricao, ip);
  }

  @Delete('fichas/:fichaId/ro/servicos/:servicoNcId/evidencias/:evidenciaId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoNcId', ParseIntPipe) servicoNcId: number,
    @Param('evidenciaId', ParseIntPipe) evidenciaId: number,
    @Ip() ip: string,
  ) {
    return this.ro.deleteRoEvidencia(tenantId, fichaId, servicoNcId, evidenciaId, user.sub, ip);
  }
}
