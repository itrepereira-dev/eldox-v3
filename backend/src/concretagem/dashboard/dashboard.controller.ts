// backend/src/concretagem/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { DashboardConcretagemService } from './dashboard.service';

@Controller('api/v1/obras/:obraId/concretagem')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardConcretagemController {
  constructor(private readonly svc: DashboardConcretagemService) {}

  // GET /api/v1/obras/:obraId/concretagem/dashboard
  @Get('dashboard')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getDashboard(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.svc.getKpis(tenantId, obraId);
    return { status: 'success', data };
  }

  // GET /api/v1/obras/:obraId/concretagem/financeiro
  @Get('financeiro')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getFinanceiro(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.svc.getFinanceiro(tenantId, obraId);
    return { status: 'success', data };
  }
}
