import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../common/decorators/tenant.decorator';
import { DashboardService } from './dashboard.service';
import { SaveLayoutDto } from './dto/save-layout.dto';

interface JwtUser { id: number; tenantId: number; roles: string[] }

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('usuarios/me/dashboard-layout')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getLayout(@CurrentUser() user: JwtUser) {
    return this.svc.getLayout(user.id);
  }

  @Put('usuarios/me/dashboard-layout')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  saveLayout(@CurrentUser() user: JwtUser, @Body() dto: SaveLayoutDto) {
    return this.svc.saveLayout(user.id, dto);
  }

  @Get('dashboard/summary')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getSummary(@TenantId() tenantId: number, @CurrentUser() user: JwtUser) {
    return this.svc.getSummary(tenantId, user.id);
  }

  @Get('dashboard/feed')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFeed(
    @TenantId() tenantId: number,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getFeed(tenantId, limit ? parseInt(limit) : 20);
  }
}
