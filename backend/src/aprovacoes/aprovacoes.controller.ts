import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../common/decorators/tenant.decorator';
import { AprovacoesService } from './aprovacoes.service';
import { CreateAprovacaoDto } from './dto/create-aprovacao.dto';
import { DecidirAprovacaoDto } from './dto/decidir-aprovacao.dto';
import { DelegarAprovacaoDto } from './dto/delegar-aprovacao.dto';
import { ListAprovacoesDto } from './dto/list-aprovacoes.dto';

interface JwtUser {
  id: number;
  tenantId: number;
  role: string;
}

@Controller('api/v1/aprovacoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AprovacoesController {
  constructor(private readonly service: AprovacoesService) {}

  // ── POST /api/v1/aprovacoes — solicitar aprovação ─────────────────────────

  @Post()
  @Roles('TECNICO', 'ENGENHEIRO', 'ADMIN_TENANT', 'LABORATORIO')
  @HttpCode(HttpStatus.CREATED)
  solicitar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAprovacaoDto,
  ) {
    return this.service.solicitar(tenantId, user.id, {
      ...dto,
      snapshotJson: dto.snapshotJson ?? {},
    });
  }

  // ── GET /api/v1/aprovacoes/pendentes-para-mim ─────────────────────────────

  @Get('pendentes-para-mim')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO')
  pendentesParaMim(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.pendentesParaMim(tenantId, user.id, user.role);
  }

  // ── GET /api/v1/aprovacoes/contagem-pendentes ─────────────────────────────

  @Get('contagem-pendentes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO')
  contarPendentes(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.contarPendentes(tenantId, user.id, user.role);
  }

  // ── GET /api/v1/aprovacoes — listar com filtros ───────────────────────────

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Query() dto: ListAprovacoesDto,
  ) {
    return this.service.listar(tenantId, user.id, user.role, dto);
  }

  // ── GET /api/v1/aprovacoes/:id — detalhe ─────────────────────────────────

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO', 'VISITANTE')
  buscar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.buscar(tenantId, id, user.id, user.role);
  }

  // ── PATCH /api/v1/aprovacoes/:id/decidir ─────────────────────────────────

  @Patch(':id/decidir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  decidir(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecidirAprovacaoDto,
  ) {
    return this.service.decidir(tenantId, id, user.id, user.role, dto);
  }

  // ── PATCH /api/v1/aprovacoes/:id/cancelar ────────────────────────────────

  @Patch(':id/cancelar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO')
  cancelar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body('motivo') motivo?: string,
  ) {
    return this.service.cancelar(tenantId, id, user.id, user.role, motivo);
  }

  // ── PATCH /api/v1/aprovacoes/:id/delegar ─────────────────────────────────

  @Patch(':id/delegar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  delegar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DelegarAprovacaoDto,
  ) {
    return this.service.delegar(tenantId, id, user.id, user.role, dto);
  }

  // ── PATCH /api/v1/aprovacoes/:id/reabrir ─────────────────────────────────

  @Patch(':id/reabrir')
  @Roles('ADMIN_TENANT')
  reabrir(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.reabrir(tenantId, id, user.id);
  }
}
