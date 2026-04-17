// backend/src/almoxarifado/compras/compras.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { ComprasService } from './compras.service';
import { CreateOcDto } from './dto/create-oc.dto';
import { ReceberOcDto } from './dto/receber-oc.dto';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  // ── Listar OCs ───────────────────────────────────────────────────────────

  @Get('ocs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @Query('local_destino_id') localDestinoId?: string,
    @Query('status') status?: string,
    @Query('limit')  limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.compras.listar(tenantId, {
      localDestinoId: localDestinoId ? Number(localDestinoId) : undefined,
      status,
      limit:  limit  ? Number(limit)  : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // ── Criar ────────────────────────────────────────────────────────────────

  @Post('ocs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @Body() dto: CreateOcDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.compras.criar(tenantId, usuarioId, dto);
  }

  // ── Detalhe ───────────────────────────────────────────────────────────────

  @Get('ocs/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  buscar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.compras.buscarOuFalhar(tenantId, id);
  }

  // ── Confirmar ─────────────────────────────────────────────────────────────

  @Patch('ocs/:id/confirmar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.compras.confirmar(tenantId, id);
  }

  // ── Emitir ────────────────────────────────────────────────────────────────

  @Patch('ocs/:id/emitir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  emitir(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.compras.emitir(tenantId, id);
  }

  // ── Receber ───────────────────────────────────────────────────────────────

  @Post('ocs/:id/receber')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  receberItens(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceberOcDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.compras.receberItens(tenantId, id, usuarioId, dto);
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────

  @Patch('ocs/:id/cancelar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.compras.cancelar(tenantId, id);
  }
}
