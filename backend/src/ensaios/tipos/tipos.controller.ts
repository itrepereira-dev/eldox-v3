// backend/src/ensaios/tipos/tipos.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { TiposService } from './tipos.service';
import { CreateTipoDto } from './dto/create-tipo.dto';
import { UpdateTipoDto } from './dto/update-tipo.dto';

const VALID_MATERIAL_TIPOS = ['bloco_concreto', 'concreto', 'argamassa', 'aco', 'ceramica', 'outro'];

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/ensaios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TiposController {
  constructor(private readonly tiposService: TiposService) {}

  // ── GET /api/v1/ensaios/tipos ──────────────────────────────────────────────

  @Get('tipos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getTipos(
    @TenantId() tenantId: number,
    @Query('ativo') ativo?: string,
    @Query('material_tipo') material_tipo?: string,
  ) {
    const ativoFiltro = ativo === 'false' ? false : ativo === 'true' ? true : undefined;
    if (material_tipo && !VALID_MATERIAL_TIPOS.includes(material_tipo)) {
      throw new BadRequestException('material_tipo inválido');
    }
    const data = await this.tiposService.listarTipos(tenantId, ativoFiltro, material_tipo);
    return { status: 'success', data };
  }

  // ── POST /api/v1/ensaios/tipos ─────────────────────────────────────────────

  @Post('tipos')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  async createTipo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateTipoDto,
  ) {
    const data = await this.tiposService.criarTipo(tenantId, user.id, dto);
    return { status: 'success', data };
  }

  // ── POST /api/v1/ensaios/tipos/seed ───────────────────────────────────────

  @Post('tipos/seed')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  async seedTipos(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
  ) {
    const data = await this.tiposService.seedTiposPadrao(tenantId, user.id);
    return { status: 'success', data };
  }

  // ── PATCH /api/v1/ensaios/tipos/:id ───────────────────────────────────────

  @Patch('tipos/:id')
  @Roles('ADMIN_TENANT')
  async updateTipo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTipoDto,
  ) {
    const data = await this.tiposService.atualizarTipo(tenantId, user.id, id, dto);
    return { status: 'success', data };
  }

  // ── PATCH /api/v1/ensaios/tipos/:id/toggle-ativo ──────────────────────────

  @Patch('tipos/:id/toggle-ativo')
  @Roles('ADMIN_TENANT')
  async toggleAtivo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.tiposService.toggleAtivo(tenantId, user.id, id);
    return { status: 'success', data };
  }

  // ── DELETE /api/v1/ensaios/tipos/:id ──────────────────────────────────────

  @Delete('tipos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTipo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.tiposService.deletarTipo(tenantId, user.id, id);
  }
}
