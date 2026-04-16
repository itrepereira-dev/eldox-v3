import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { EfetivoIaService } from './efetivo-ia.service';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EfetivoIaController {
  constructor(private readonly iaService: EfetivoIaService) {}

  @Get('obras/:obraId/efetivo/ia/sugestao')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  getSugestao(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('turno') turno: string,
  ) {
    return this.iaService.getSugestao(tenantId, obraId, turno ?? 'INTEGRAL');
  }

  @Get('efetivo/alertas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  getAlertas(@TenantId() tenantId: number) {
    return this.iaService.getAlertas(tenantId);
  }

  @Patch('efetivo/alertas/:id/lido')
  @HttpCode(204)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  marcarLido(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.iaService.marcarAlertaLido(tenantId, id);
  }
}
