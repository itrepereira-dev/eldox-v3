// backend/src/concretagem/corpos-de-prova/cps.controller.ts
import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { CpsService } from './cps.service';
import { CreateCpDto } from './dto/create-cp.dto';
import { RegistrarRupturaDto } from './dto/registrar-ruptura.dto';

@Controller('api/v1/concretagem')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CpsController {
  constructor(private readonly svc: CpsService) {}

  // POST /api/v1/concretagem/concretagens/:concretagemId/cps
  @Post('concretagens/:concretagemId/cps')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async moldagem(
    @Param('concretagemId', ParseIntPipe) concrtagemId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateCpDto,
  ) {
    const data = await this.svc.moldagem(tenantId, concrtagemId, user.id, dto);
    return { status: 'success', data };
  }

  // PATCH /api/v1/concretagem/cps/:id/ruptura
  @Patch('cps/:id/ruptura')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async registrarRuptura(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: RegistrarRupturaDto,
  ) {
    const data = await this.svc.registrarRuptura(tenantId, id, user.id, dto);
    return { status: 'success', data };
  }

  // GET /api/v1/concretagem/concretagens/:concretagemId/cps
  @Get('concretagens/:concretagemId/cps')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listarPorConcretagem(
    @Param('concretagemId', ParseIntPipe) concrtagemId: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.svc.listarPorConcretagem(tenantId, concrtagemId);
    return { status: 'success', data };
  }
}
