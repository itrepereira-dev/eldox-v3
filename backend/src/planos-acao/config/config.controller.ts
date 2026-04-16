// backend/src/planos-acao/config/config.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseIntPipe, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { ConfigPlanosAcaoService } from './config.service';
import { CreateCicloDto } from '../dto/create-ciclo.dto';
import { UpdateCicloDto } from '../dto/update-ciclo.dto';
import { CreateEtapaDto } from '../dto/create-etapa.dto';
import { UpdateEtapaDto } from '../dto/update-etapa.dto';
import { CreateCampoDto } from '../dto/create-campo.dto';
import { UpdateCampoDto } from '../dto/update-campo.dto';
import { CreateGatilhoDto } from '../dto/create-gatilho.dto';
import { UpdateGatilhoDto } from '../dto/update-gatilho.dto';

@Controller('api/v1/planos-acao/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController {
  constructor(private readonly config: ConfigPlanosAcaoService) {}

  // ── Ciclos ──────────────────────────────────────────────────────────────────

  @Get('ciclos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listCiclos(
    @TenantId() tenantId: number,
    @Query('modulo') modulo?: string,
  ) {
    return this.config.listCiclos(tenantId, modulo);
  }

  @Post('ciclos')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createCiclo(
    @TenantId() tenantId: number,
    @Body() dto: CreateCicloDto,
  ) {
    return this.config.createCiclo(tenantId, dto);
  }

  @Patch('ciclos/:id')
  @Roles('ADMIN_TENANT')
  updateCiclo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCicloDto,
  ) {
    return this.config.updateCiclo(tenantId, id, dto);
  }

  @Delete('ciclos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCiclo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.config.deleteCiclo(tenantId, id);
  }

  // ── Etapas ──────────────────────────────────────────────────────────────────

  @Get('ciclos/:id/etapas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listEtapas(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) cicloId: number,
  ) {
    return this.config.listEtapas(tenantId, cicloId);
  }

  @Post('ciclos/:id/etapas')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createEtapa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) cicloId: number,
    @Body() dto: CreateEtapaDto,
  ) {
    return this.config.createEtapa(tenantId, cicloId, dto);
  }

  @Patch('etapas/:id')
  @Roles('ADMIN_TENANT')
  updateEtapa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEtapaDto,
  ) {
    return this.config.updateEtapa(tenantId, id, dto);
  }

  @Delete('etapas/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEtapa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.config.deleteEtapa(tenantId, id);
  }

  // ── Campos ──────────────────────────────────────────────────────────────────

  @Post('etapas/:id/campos')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createCampo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) etapaId: number,
    @Body() dto: CreateCampoDto,
  ) {
    return this.config.createCampo(tenantId, etapaId, dto);
  }

  @Patch('campos/:id')
  @Roles('ADMIN_TENANT')
  updateCampo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampoDto,
  ) {
    return this.config.updateCampo(tenantId, id, dto);
  }

  @Delete('campos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCampo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.config.deleteCampo(tenantId, id);
  }

  // ── Gatilhos ────────────────────────────────────────────────────────────────

  @Get('ciclos/:id/gatilhos')
  @Roles('ADMIN_TENANT')
  listGatilhos(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) cicloId: number,
  ) {
    return this.config.listGatilhos(tenantId, cicloId);
  }

  @Post('ciclos/:id/gatilhos')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createGatilho(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) cicloId: number,
    @Body() dto: CreateGatilhoDto,
  ) {
    return this.config.createGatilho(tenantId, cicloId, dto);
  }

  @Patch('gatilhos/:id')
  @Roles('ADMIN_TENANT')
  updateGatilho(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGatilhoDto,
  ) {
    return this.config.updateGatilho(tenantId, id, dto);
  }

  @Delete('gatilhos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGatilho(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.config.deleteGatilho(tenantId, id);
  }
}
