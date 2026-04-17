// backend/src/almoxarifado/ia/ia.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { AgenteReorderService } from './agente-reorder.service';
import { AgenteAnomaliaService } from './agente-anomalia.service';
import type { AlmInsightsResult } from '../types/alm.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/almoxarifado')
export class IaController {
  constructor(
    private readonly reorder: AgenteReorderService,
    private readonly anomalia: AgenteAnomaliaService,
  ) {}

  /**
   * GET /api/v1/almoxarifado/obras/:obraId/insights
   * Executa análise IA sob demanda e retorna reorder + anomalias.
   */
  @Get('obras/:obraId/insights')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async getInsights(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ): Promise<AlmInsightsResult> {
    const [reorder, anomalias] = await Promise.all([
      this.reorder.executar(tenantId, obraId),
      this.anomalia.executar(tenantId, obraId),
    ]);

    return {
      reorder,
      anomalias,
      analisado_em: new Date(),
      modelo: 'claude-haiku-4-5-20251001',
    };
  }
}
