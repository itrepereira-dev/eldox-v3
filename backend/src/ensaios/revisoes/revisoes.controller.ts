// backend/src/ensaios/revisoes/revisoes.controller.ts
import {
  Controller, Get, Patch,
  Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';

const PRIORIDADES_VALIDAS = ['normal', 'alta'];
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { RevisoesService } from './revisoes.service';
import { RevisarLaudoDto } from '../dto/revisar-laudo.dto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/ensaios/revisoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RevisoesController {
  constructor(private readonly revisoesService: RevisoesService) {}

  // ── GET /api/v1/ensaios/revisoes?obra_id=X ────────────────────────────────

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getRevisoes(
    @TenantId() tenantId: number,
    @Query('obra_id', ParseIntPipe) obraId: number,
    @Query('situacao') situacao?: string,
    @Query('prioridade') prioridade?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (prioridade && !PRIORIDADES_VALIDAS.includes(prioridade)) {
      throw new BadRequestException('prioridade inválida');
    }
    const data = await this.revisoesService.listarRevisoes(tenantId, {
      obra_id: obraId,
      situacao,
      prioridade,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { status: 'success', data };
  }

  // ── GET /api/v1/ensaios/revisoes/:id ──────────────────────────────────────

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getRevisao(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.revisoesService.buscarRevisao(tenantId, id);
    return { status: 'success', data };
  }

  // ── PATCH /api/v1/ensaios/revisoes/:id ────────────────────────────────────

  @Patch(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async revisarLaudo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisarLaudoDto,
  ) {
    const data = await this.revisoesService.revisarLaudo(
      tenantId,
      user.id,
      user.role,
      id,
      dto,
    );
    return { status: 'success', data };
  }
}
