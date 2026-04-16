// backend/src/ensaios/dashboard/dashboard.controller.ts
import {
  Controller, Get, Query, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { DashboardService } from './dashboard.service';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // GET /api/v1/dashboard/materiais?obra_id=X
  @Get('materiais')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getMateriaisKpis(
    @TenantId() tenantId: number,
    @Query('obra_id', ParseIntPipe) obraId: number,
  ) {
    const data = await this.dashboardService.getMateriaisKpis(tenantId, obraId);
    return { status: 'success', data };
  }
}
