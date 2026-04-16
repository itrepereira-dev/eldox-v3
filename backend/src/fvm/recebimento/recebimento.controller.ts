// backend/src/fvm/recebimento/recebimento.controller.ts
import {
  Controller, Get, Post, Put,
  Body, Param, Query, ParseIntPipe,
  UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { RecebimentoService } from './recebimento.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { PutRegistroDto } from './dto/put-registro.dto';
import { ConcluirInspecaoDto } from './dto/concluir-inspecao.dto';
import { LiberarQuarentenaDto } from './dto/liberar-quarentena.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Controller('api/v1/fvm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecebimentoController {
  constructor(private readonly service: RecebimentoService) {}

  // ── Grade ──────────────────────────────────────────────────────────────────

  /** GET /api/v1/fvm/obras/:obraId/grade */
  @Get('obras/:obraId/grade')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getGrade(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('categoriaId') categoriaId?: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getGrade(tenantId, obraId, {
      categoriaId:  categoriaId  ? Number(categoriaId)  : undefined,
      fornecedorId: fornecedorId ? Number(fornecedorId) : undefined,
      status,
    });
  }

  /** GET /api/v1/fvm/obras/:obraId/dashboard */
  @Get('obras/:obraId/dashboard')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getDashboard(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query() query: DashboardQueryDto,
  ) {
    return this.service.getDashboard(tenantId, obraId, {
      data_inicio: query.data_inicio,
      data_fim:    query.data_fim,
    });
  }

  /** GET /api/v1/fvm/obras/:obraId/ncs — for R-FVM2 report */
  @Get('obras/:obraId/ncs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getNcsRelatorio(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('data_inicio') dataInicio?: string,
    @Query('data_fim') dataFim?: string,
    @Query('status') status?: string,
    @Query('criticidade') criticidade?: string,
    @Query('fornecedor_id') fornecedorId?: string,
  ) {
    return this.service.getNcsRelatorio(tenantId, obraId, {
      dataInicio,
      dataFim,
      status,
      criticidade,
      fornecedorId: fornecedorId ? Number(fornecedorId) : undefined,
    });
  }

  // ── Lotes ──────────────────────────────────────────────────────────────────

  /** POST /api/v1/fvm/obras/:obraId/lotes */
  @Post('obras/:obraId/lotes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  createLote(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Req() req: any,
    @Body() dto: CreateLoteDto,
  ) {
    return this.service.createLote(tenantId, obraId, req.user.id, dto);
  }

  /** GET /api/v1/fvm/lotes/:loteId (preview para Drawer) */
  @Get('lotes/:loteId/preview')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getLotePreview(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
  ) {
    return this.service.getLotePreview(tenantId, loteId);
  }

  /** GET /api/v1/fvm/lotes/:loteId (ficha completa) */
  @Get('lotes/:loteId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getLote(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
  ) {
    return this.service.getLote(tenantId, loteId);
  }

  // ── Inspeção ──────────────────────────────────────────────────────────────

  /** PUT /api/v1/fvm/lotes/:loteId/registros — upsert por item */
  @Put('lotes/:loteId/registros')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  putRegistro(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
    @Req() req: any,
    @Body() dto: PutRegistroDto,
  ) {
    return this.service.putRegistro(tenantId, loteId, req.user.id, dto);
  }

  /** POST /api/v1/fvm/lotes/:loteId/concluir */
  @Post('lotes/:loteId/concluir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  concluirInspecao(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
    @Req() req: any,
    @Body() dto: ConcluirInspecaoDto,
  ) {
    return this.service.concluirInspecao(tenantId, loteId, req.user.id, dto);
  }

  /** POST /api/v1/fvm/lotes/:loteId/liberar-quarentena */
  @Post('lotes/:loteId/liberar-quarentena')
  @Roles('ENGENHEIRO', 'ADMIN_TENANT')
  @HttpCode(HttpStatus.OK)
  liberarQuarentena(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
    @Req() req: any,
    @Body() dto: LiberarQuarentenaDto,
  ) {
    return this.service.liberarQuarentena(tenantId, req.user.id, loteId, dto)
      .then(data => ({ status: 'success', data }));
  }
}
