// backend/src/concretagem/laudos/laudos.controller.ts
import {
  Controller,
  Get,
  Post,
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
import { LaudosService } from './laudos.service';
import { CreateLaudoDto } from './dto/create-laudo.dto';

@Controller('api/v1/concretagem/laudos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaudosController {
  constructor(private readonly svc: LaudosService) {}

  // POST /api/v1/concretagem/laudos
  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'LABORATORIO')
  @HttpCode(HttpStatus.CREATED)
  async criar(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateLaudoDto,
  ) {
    const data = await this.svc.criar(tenantId, user.id, dto);
    return { status: 'success', data };
  }

  // GET /api/v1/concretagem/laudos/concretagem/:concretagemId
  @Get('concretagem/:concretagemId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE', 'LABORATORIO')
  async listarPorConcretagem(
    @Param('concretagemId', ParseIntPipe) concrtagemId: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.svc.listarPorConcretagem(tenantId, concrtagemId);
    return { status: 'success', data };
  }

  // GET /api/v1/concretagem/laudos/:id
  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE', 'LABORATORIO')
  async buscar(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.svc.buscar(tenantId, id);
    return { status: 'success', data };
  }

  // POST /api/v1/concretagem/laudos/:id/aprovar
  @Post(':id/aprovar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async aprovar(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
  ) {
    const data = await this.svc.aprovar(tenantId, id, user.id);
    return { status: 'success', data };
  }

  // POST /api/v1/concretagem/laudos/:id/reprovar
  @Post(':id/reprovar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async reprovar(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
  ) {
    const data = await this.svc.reprovar(tenantId, id, user.id);
    return { status: 'success', data };
  }
}
