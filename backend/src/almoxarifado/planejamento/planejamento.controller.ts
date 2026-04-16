// backend/src/almoxarifado/planejamento/planejamento.controller.ts
import {
  Controller, Get, Post, Delete,
  Param, Query, Body,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { PlanejamentoService } from './planejamento.service';
import { UpsertPlanejamentoDto } from './dto/upsert-planejamento.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/almoxarifado')
export class PlanejamentoController {
  constructor(private readonly svc: PlanejamentoService) {}

  /** GET /obras/:obraId/planejamento?mes=4&ano=2026 */
  @Get('obras/:obraId/planejamento')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('mes') mes?: string,
    @Query('ano') ano?: string,
  ) {
    return this.svc.listar(
      tenantId, obraId,
      mes ? Number(mes) : undefined,
      ano ? Number(ano) : undefined,
    );
  }

  /** GET /obras/:obraId/planejamento/periodos */
  @Get('obras/:obraId/planejamento/periodos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getPeriodos(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.svc.getPeriodos(tenantId, obraId);
  }

  /** POST /obras/:obraId/planejamento */
  @Post('obras/:obraId/planejamento')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  upsert(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Body() dto: UpsertPlanejamentoDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.svc.upsert(tenantId, obraId, usuarioId, dto);
  }

  /** DELETE /obras/:obraId/planejamento/:id */
  @Delete('obras/:obraId/planejamento/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  remover(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.remover(tenantId, id);
  }
}
