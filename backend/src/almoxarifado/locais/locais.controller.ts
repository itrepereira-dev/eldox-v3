// backend/src/almoxarifado/locais/locais.controller.ts
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { LocaisService } from './locais.service';
import { CreateLocalDto } from './dto/create-local.dto';
import { UpdateLocalDto } from './dto/update-local.dto';

@Controller('api/v1/almoxarifado/locais')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocaisController {
  constructor(private readonly locais: LocaisService) {}

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @Query('tipo')    tipo?: string,
    @Query('ativo')   ativo?: string,
    @Query('obra_id') obraId?: string,
  ) {
    return this.locais.listar(tenantId, {
      tipo,
      ativo:   ativo !== undefined ? ativo === 'true' : undefined,
      obra_id: obraId ? Number(obraId) : undefined,
    });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  buscarPorId(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.locais.buscarPorId(tenantId, id);
  }

  @Post()
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @Body() dto: CreateLocalDto,
  ) {
    return this.locais.criar(tenantId, dto);
  }

  @Put(':id')
  @Roles('ADMIN_TENANT')
  atualizar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocalDto,
  ) {
    return this.locais.atualizar(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN_TENANT')
  desativar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.locais.desativar(tenantId, id);
  }
}
