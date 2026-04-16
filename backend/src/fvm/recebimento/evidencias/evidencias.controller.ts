// backend/src/fvm/recebimento/evidencias/evidencias.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { EvidenciasService } from './evidencias.service';
import { VincularEvidenciaDto } from './dto/vincular-evidencia.dto';

@Controller('api/v1/fvm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvidenciasController {
  constructor(private readonly service: EvidenciasService) {}

  // ── POST /api/v1/fvm/lotes/:loteId/evidencias ─────────────────────────────

  /** Vincula uma versão GED como evidência de um lote FVM */
  @Post('lotes/:loteId/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async vincular(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
    @Req() req: any,
    @Body() dto: VincularEvidenciaDto,
  ) {
    const data = await this.service.vincular(tenantId, req.user.id, loteId, dto);
    return { status: 'success', data };
  }

  // ── GET /api/v1/fvm/lotes/:loteId/evidencias ──────────────────────────────

  /** Lista todas as evidências GED vinculadas ao lote, com presigned URLs */
  @Get('lotes/:loteId/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listar(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
    @Req() req: any,
  ) {
    const data = await this.service.listar(tenantId, req.user.id, loteId);
    return { status: 'success', data };
  }

  // ── DELETE /api/v1/fvm/evidencias/:id ─────────────────────────────────────

  /** Remove o vínculo entre evidência GED e lote (hard delete do vínculo, não do doc GED) */
  @Delete('evidencias/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async desvincular(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const data = await this.service.desvincular(tenantId, req.user.id, id);
    return { status: 'success', data };
  }
}
