// backend/src/ensaios/ensaios.controller.ts
import {
  Controller, Get, Post,
  Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../common/decorators/tenant.decorator';
import { EnsaiosService } from './ensaios.service';
import { CreateEnsaioDto, ListarEnsaiosQuery } from './dto/create-ensaio.dto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/ensaios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnsaiosController {
  constructor(private readonly ensaiosService: EnsaiosService) {}

  // ── GET /api/v1/ensaios?obra_id=X ─────────────────────────────────────────

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getEnsaios(
    @TenantId() tenantId: number,
    @Query() query: ListarEnsaiosQuery,
  ) {
    const data = await this.ensaiosService.listarEnsaios(tenantId, query);
    return { status: 'success', data };
  }

  // ── POST /api/v1/ensaios ───────────────────────────────────────────────────

  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async createEnsaio(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateEnsaioDto,
  ) {
    const data = await this.ensaiosService.criarEnsaio(tenantId, user.id, dto);
    return { status: 'success', data };
  }

  // ── GET /api/v1/ensaios/:id ────────────────────────────────────────────────
  // NestJS resolve rotas literais (tipos, laboratorios) antes de :id — sem conflito.

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getEnsaio(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.ensaiosService.buscarEnsaio(tenantId, id);
    return { status: 'success', data };
  }
}
