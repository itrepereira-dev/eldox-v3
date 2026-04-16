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
  Ip,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../common/decorators/tenant.decorator';
import { EfetivoService } from './efetivo.service';
import { CreateRegistroDto } from './dto/create-registro.dto';
import { PatchItemDto } from './dto/patch-item.dto';
import { QueryEfetivoDto } from './dto/query-efetivo.dto';

interface JwtUser {
  id: number;
  tenantId: number;
  role: string;
}

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EfetivoController {
  constructor(private readonly service: EfetivoService) {}

  // POST /api/v1/obras/:obraId/efetivo
  @Post('obras/:obraId/efetivo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  createRegistro(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Body() dto: CreateRegistroDto,
    @Ip() ip: string,
  ) {
    return this.service.createRegistro(tenantId, user.id, obraId, dto, ip);
  }

  // GET /api/v1/obras/:obraId/efetivo
  @Get('obras/:obraId/efetivo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRegistros(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query() query: QueryEfetivoDto,
  ) {
    return this.service.getRegistros(tenantId, obraId, query);
  }

  // GET /api/v1/obras/:obraId/efetivo/:id
  @Get('obras/:obraId/efetivo/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRegistro(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getRegistro(tenantId, obraId, id);
  }

  // PATCH /api/v1/obras/:obraId/efetivo/:registroId/itens/:itemId
  @Patch('obras/:obraId/efetivo/:registroId/itens/:itemId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  patchItem(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('registroId', ParseIntPipe) registroId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: PatchItemDto,
    @Ip() ip: string,
  ) {
    return this.service.patchItem(tenantId, obraId, registroId, itemId, dto, user.id, ip);
  }

  // POST /api/v1/obras/:obraId/efetivo/:id/fechar
  @Post('obras/:obraId/efetivo/:id/fechar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  fecharRegistro(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.service.fecharRegistro(tenantId, obraId, id, user.id, ip);
  }

  // POST /api/v1/obras/:obraId/efetivo/:id/reabrir
  @Post('obras/:obraId/efetivo/:id/reabrir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  reabrirRegistro(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.service.reabrirRegistro(tenantId, obraId, id, user.id, ip);
  }
}
