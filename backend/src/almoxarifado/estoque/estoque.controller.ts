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
import { TransferenciaDto } from './dto/transferencia.dto';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  // ── Locais ────────────────────────────────────────────────────────────────

  @Get('obras/:obraId/estoque/locais')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getLocais(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.estoque.getLocais(tenantId, obraId);
  }

  @Post('obras/:obraId/estoque/locais')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createLocal(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Body() dto: { nome: string; descricao?: string },
  ) {
    return this.estoque.createLocal(tenantId, obraId, dto);
  }

  // ── Saldo ─────────────────────────────────────────────────────────────────

  @Get('obras/:obraId/estoque')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getSaldo(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('localId')    localId?: string,
    @Query('catalogoId') catalogoId?: string,
    @Query('nivel')      nivel?: string,
  ) {
    return this.estoque.getSaldo(tenantId, obraId, {
      localId:    localId    ? Number(localId)    : undefined,
      catalogoId: catalogoId ? Number(catalogoId) : undefined,
      nivel,
    });
  }

  // ── Movimentos ────────────────────────────────────────────────────────────

  @Get('obras/:obraId/estoque/movimentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getMovimentos(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('catalogoId') catalogoId?: string,
    @Query('tipo')       tipo?: string,
    @Query('limit')      limit?: string,
    @Query('offset')     offset?: string,
  ) {
    return this.estoque.getMovimentos(tenantId, obraId, {
      catalogoId: catalogoId ? Number(catalogoId) : undefined,
      tipo,
      limit:  limit  ? Number(limit)  : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('obras/:obraId/estoque/movimentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  registrarMovimento(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Body() dto: CreateMovimentoDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.registrarMovimento(tenantId, obraId, usuarioId, dto);
  }

  @Post('obras/:obraId/estoque/transferencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  transferir(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Body() dto: TransferenciaDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.transferir(tenantId, obraId, usuarioId, dto);
  }

  // ── Alertas ───────────────────────────────────────────────────────────────

  @Get('obras/:obraId/estoque/alertas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getAlertas(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('todos') todos?: string,
  ) {
    return this.estoque.getAlertas(tenantId, obraId, todos !== 'true');
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

  @Patch('obras/:obraId/estoque/alertas/ler-todos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  marcarTodosLidos(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.marcarTodosLidos(tenantId, obraId, usuarioId);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('obras/:obraId/dashboard')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getDashboard(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.estoque.getDashboardKpis(tenantId, obraId);
  }
}
