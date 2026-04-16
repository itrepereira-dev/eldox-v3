// backend/src/semaforo/semaforo.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { SemaforoService } from './semaforo.service';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SemaforoController {
  constructor(private readonly semaforo: SemaforoService) {}

  // ── GET /semaforo — semáforo de todas as obras do tenant ─────────────────

  @Get('semaforo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getSemaforoGlobal(@TenantId() tenantId: number) {
    const data = await this.semaforo.getSemaforoTodasObras(tenantId);
    return { status: 'success', data };
  }

  // ── GET /obras/:obraId/semaforo — semáforo de uma obra ───────────────────

  @Get('obras/:obraId/semaforo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getSemaforoObra(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    const data = await this.semaforo.getSemaforo(tenantId, obraId);
    return { status: 'success', data };
  }

  // ── POST /obras/:obraId/semaforo/recalcular — força recálculo ────────────

  @Post('obras/:obraId/semaforo/recalcular')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async recalcularSemaforo(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    const data = await this.semaforo.calcularSemaforo(tenantId, obraId);
    return { status: 'success', data };
  }
}
