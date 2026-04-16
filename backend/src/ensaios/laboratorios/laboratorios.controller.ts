// backend/src/ensaios/laboratorios/laboratorios.controller.ts
import {
  Controller, Get, Post, Patch,
  Body, Param, ParseIntPipe,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { LaboratoriosService } from './laboratorios.service';
import { CreateLaboratorioDto } from './dto/create-laboratorio.dto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/ensaios/laboratorios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaboratoriosController {
  constructor(private readonly laboratoriosService: LaboratoriosService) {}

  // ── GET /api/v1/ensaios/laboratorios ──────────────────────────────────────

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async getLaboratorios(@TenantId() tenantId: number) {
    const data = await this.laboratoriosService.listar(tenantId);
    return { status: 'success', data };
  }

  // ── POST /api/v1/ensaios/laboratorios ─────────────────────────────────────

  @Post()
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  async createLaboratorio(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateLaboratorioDto,
  ) {
    const data = await this.laboratoriosService.criar(tenantId, user.id, dto);
    return { status: 'success', data };
  }

  // ── PATCH /api/v1/ensaios/laboratorios/:id/toggle-ativo ───────────────────

  @Patch(':id/toggle-ativo')
  @Roles('ADMIN_TENANT')
  async toggleAtivo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.laboratoriosService.toggleAtivo(tenantId, user.id, id);
    return { status: 'success', data };
  }
}
