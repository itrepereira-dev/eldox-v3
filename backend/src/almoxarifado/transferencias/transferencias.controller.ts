// backend/src/almoxarifado/transferencias/transferencias.controller.ts
import {
  Controller, Get, Post,
  Body, Param, Query, ParseIntPipe,
  UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { TransferenciasService } from './transferencias.service';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { AprovarTransferenciaDto } from './dto/aprovar-transferencia.dto';
import { ExecutarTransferenciaDto } from './dto/executar-transferencia.dto';
import { CancelarTransferenciaDto } from './dto/cancelar-transferencia.dto';

@Controller('api/v1/almoxarifado/transferencias')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransferenciasController {
  constructor(private readonly transferencias: TransferenciasService) {}

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @Query('status')           status?: string,
    @Query('local_origem_id')  localOrigemId?: string,
    @Query('local_destino_id') localDestinoId?: string,
    @Query('page')             page?: string,
    @Query('per_page')         perPage?: string,
  ) {
    return this.transferencias.listar(tenantId, {
      status,
      local_origem_id:  localOrigemId  ? Number(localOrigemId)  : undefined,
      local_destino_id: localDestinoId ? Number(localDestinoId) : undefined,
      page:     page    ? Number(page)    : undefined,
      per_page: perPage ? Number(perPage) : undefined,
    });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  buscarPorId(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.transferencias.buscarPorId(tenantId, id);
  }

  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @Body() dto: CreateTransferenciaDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.transferencias.criar(tenantId, usuarioId, dto);
  }

  @Post(':id/aprovar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  aprovar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() _dto: AprovarTransferenciaDto,
    @Req() req: any,
  ) {
    const aprovadorId: number = req.user?.sub ?? req.user?.id;
    const userRoles: string[] = req.user?.roles ?? [];
    return this.transferencias.aprovar(tenantId, aprovadorId, id, userRoles);
  }

  @Post(':id/executar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  executar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExecutarTransferenciaDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.transferencias.executar(tenantId, usuarioId, id, dto);
  }

  @Post(':id/cancelar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  cancelar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarTransferenciaDto,
  ) {
    return this.transferencias.cancelar(tenantId, id, dto);
  }
}
