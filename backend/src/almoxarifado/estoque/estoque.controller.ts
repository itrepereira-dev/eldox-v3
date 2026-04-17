// backend/src/almoxarifado/estoque/estoque.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { EstoqueService } from './estoque.service';
import { CreateMovimentoDto } from './dto/create-movimento.dto';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  // ── Saldo ─────────────────────────────────────────────────────────────────

  @Get('estoque/saldo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getSaldo(
    @TenantId() tenantId: number,
    @Query('local_id')   localId?: string,
    @Query('tipo_local') tipoLocal?: string,
    @Query('catalogoId') catalogoId?: string,
    @Query('nivel')      nivel?: string,
  ) {
    return this.estoque.getSaldo(tenantId, {
      localId:    localId    ? Number(localId)    : undefined,
      tipoLocal,
      catalogoId: catalogoId ? Number(catalogoId) : undefined,
      nivel,
    });
  }

  // ── Movimentos ────────────────────────────────────────────────────────────

  @Get('estoque/movimentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getMovimentos(
    @TenantId() tenantId: number,
    @Query('local_id')   localId?: string,
    @Query('tipo_local') tipoLocal?: string,
    @Query('catalogoId') catalogoId?: string,
    @Query('tipo')       tipo?: string,
    @Query('limit')      limit?: string,
    @Query('offset')     offset?: string,
  ) {
    return this.estoque.getMovimentos(tenantId, {
      localId:    localId    ? Number(localId)    : undefined,
      tipoLocal,
      catalogoId: catalogoId ? Number(catalogoId) : undefined,
      tipo,
      limit:  limit  ? Number(limit)  : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('estoque/movimentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  registrarMovimento(
    @TenantId() tenantId: number,
    @Body() dto: CreateMovimentoDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.registrarMovimento(tenantId, dto.local_id, usuarioId, dto);
  }

  // ── Alertas ───────────────────────────────────────────────────────────────

  @Get('estoque/alertas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getAlertas(
    @TenantId() tenantId: number,
    @Query('local_id') localId?: string,
    @Query('todos')    todos?: string,
  ) {
    return this.estoque.getAlertas(
      tenantId,
      localId ? Number(localId) : undefined,
      todos !== 'true',
    );
  }

  @Patch('estoque/alertas/:id/ler')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  marcarAlertaLido(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) alertaId: number,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.marcarAlertaLido(tenantId, alertaId, usuarioId);
  }

  @Patch('estoque/alertas/ler-todos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  marcarTodosLidos(
    @TenantId() tenantId: number,
    @Req() req: any,
    @Query('local_id') localId?: string,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.marcarTodosLidos(
      tenantId,
      localId ? Number(localId) : undefined,
      usuarioId,
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getDashboard(
    @TenantId() tenantId: number,
    @Query('local_id') localId?: string,
  ) {
    return this.estoque.getDashboardKpis(tenantId, localId ? Number(localId) : undefined);
  }
}
