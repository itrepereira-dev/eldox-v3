// backend/src/concretagem/racs/racs.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { RacsService } from './racs.service';
import { CreateRacDto } from './dto/create-rac.dto';

@Controller('api/v1/obras/:obraId/concretagem/racs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RacsController {
  constructor(private readonly svc: RacsService) {}

  // POST /api/v1/obras/:obraId/concretagem/racs
  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async criar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateRacDto,
  ) {
    // Ensure obra_id from route takes precedence
    const data = await this.svc.criar(tenantId, user.id, { ...dto, obra_id: obraId });
    return { status: 'success', data };
  }

  // GET /api/v1/obras/:obraId/concretagem/racs
  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE', 'LABORATORIO')
  async listar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @Query('status') status?: string,
  ) {
    const data = await this.svc.listar(tenantId, obraId, status);
    return { status: 'success', data };
  }

  // GET /api/v1/obras/:obraId/concretagem/racs/:id
  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE', 'LABORATORIO')
  async buscar(
    @Param('obraId', ParseIntPipe) _obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.svc.buscar(tenantId, id);
    return { status: 'success', data };
  }

  // PATCH /api/v1/obras/:obraId/concretagem/racs/:id
  @Patch(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  async atualizar(
    @Param('obraId', ParseIntPipe) _obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: Partial<CreateRacDto> & { status?: string },
  ) {
    const data = await this.svc.atualizar(tenantId, id, user.id, dto);
    return { status: 'success', data };
  }

  // POST /api/v1/obras/:obraId/concretagem/racs/:id/verificar-eficacia
  @Post(':id/verificar-eficacia')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async verificarEficacia(
    @Param('obraId', ParseIntPipe) _obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
  ) {
    const data = await this.svc.verificarEficacia(tenantId, id, user.id);
    return { status: 'success', data };
  }
}
