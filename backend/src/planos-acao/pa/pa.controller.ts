// backend/src/planos-acao/pa/pa.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseIntPipe, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { PaService } from './pa.service';
import { CreatePaDto } from '../dto/create-pa.dto';
import { UpdatePaDto } from '../dto/update-pa.dto';
import { TransicaoDto } from '../dto/transicao.dto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/planos-acao')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaController {
  constructor(private readonly pa: PaService) {}

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listPas(
    @TenantId() tenantId: number,
    @Query('obraId',        new ParseIntPipe({ optional: true })) obraId?: number,
    @Query('etapaId',       new ParseIntPipe({ optional: true })) etapaId?: number,
    @Query('responsavelId', new ParseIntPipe({ optional: true })) responsavelId?: number,
    @Query('page',          new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit',         new ParseIntPipe({ optional: true })) limit?: number,
    @Query('prioridade') prioridade?: string,
    @Query('modulo')     modulo?: string,
  ) {
    return this.pa.listPas(tenantId, { obraId, etapaId, prioridade, responsavelId, modulo, page, limit });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getPa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pa.getPa(tenantId, id);
  }

  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createPa(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePaDto,
  ) {
    return this.pa.createPa(tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updatePa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaDto,
  ) {
    return this.pa.updatePa(tenantId, id, dto);
  }

  @Post(':id/transicao')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  transicionarEtapa(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransicaoDto,
  ) {
    return this.pa.transicionarEtapa(tenantId, id, user.id, user.role, dto);
  }

  @Delete(':id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pa.deletePa(tenantId, id);
  }
}
