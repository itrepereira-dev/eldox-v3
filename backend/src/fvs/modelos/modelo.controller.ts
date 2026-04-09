// backend/src/fvs/modelos/modelo.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { ModeloService } from './modelo.service';
import { CreateModeloDto } from './dto/create-modelo.dto';
import { UpdateModeloDto } from './dto/update-modelo.dto';
import { CreateModeloServicoDto } from './dto/create-modelo-servico.dto';
import { UpdateModeloServicoDto } from './dto/update-modelo-servico.dto';
import { VincularObrasDto } from './dto/vincular-obras.dto';

interface JwtUser { sub: number; tenantId: number; role: string }

@Controller('api/v1/fvs/modelos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModeloController {
  constructor(private readonly modeloService: ModeloService) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createModelo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateModeloDto,
  ) {
    return this.modeloService.createModelo(tenantId, user.sub, dto);
  }

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getModelos(
    @TenantId() tenantId: number,
    @Query('escopo') escopo?: string,
    @Query('status') status?: string,
  ) {
    return this.modeloService.getModelos(tenantId, { escopo, status });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getModelo(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.modeloService.getModelo(tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateModelo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateModeloDto,
  ) {
    return this.modeloService.updateModelo(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteModelo(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.modeloService.deleteModelo(tenantId, id);
  }

  @Post(':id/concluir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  concluirModelo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.modeloService.concluirModelo(tenantId, id, user.sub);
  }

  @Post(':id/reabrir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  reabrirModelo(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.modeloService.reabrirModelo(tenantId, id);
  }

  @Post(':id/duplicar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  duplicarModelo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.modeloService.duplicarModelo(tenantId, id, user.sub);
  }

  // ─── Obras vinculadas ao template ─────────────────────────────────────────

  @Get(':id/obras')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getObrasModelo(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.modeloService.getObrasByModelo(tenantId, id);
  }

  @Post(':id/obras')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  vincularObras(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VincularObrasDto,
  ) {
    return this.modeloService.vincularObras(tenantId, id, dto.obraIds, user.sub);
  }

  // ─── Serviços do template ─────────────────────────────────────────────────

  @Post(':id/servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  addServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateModeloServicoDto,
  ) {
    return this.modeloService.addServicoModelo(tenantId, id, dto);
  }

  @Patch(':id/servicos/:servicoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('servicoId', ParseIntPipe) servicoId: number,
    @Body() dto: UpdateModeloServicoDto,
  ) {
    return this.modeloService.updateServicoModelo(tenantId, id, servicoId, dto);
  }

  @Delete(':id/servicos/:servicoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('servicoId', ParseIntPipe) servicoId: number,
  ) {
    return this.modeloService.deleteServicoModelo(tenantId, id, servicoId);
  }
}
