// backend/src/fvm/recebimento/ensaios/ensaios.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../../common/decorators/tenant.decorator';
import { EnsaiosService } from './ensaios.service';
import { RegistrarEnsaioDto } from '../dto/ensaio.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1')
export class EnsaiosController {
  constructor(private readonly ensaios: EnsaiosService) {}

  // GET /fvm/materiais/:materialId/ensaio-templates
  @Get('fvm/materiais/:materialId/ensaio-templates')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO')
  listarTemplates(
    @TenantId() tenantId: number,
    @Param('materialId', ParseIntPipe) materialId: number,
  ) {
    return this.ensaios.listarTemplatesPorMaterial(tenantId, materialId);
  }

  // GET /fvm/lotes/:loteId/ensaios
  @Get('fvm/lotes/:loteId/ensaios')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO')
  listar(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
  ) {
    return this.ensaios.listarPorLote(tenantId, loteId);
  }

  // POST /fvm/lotes/:loteId/ensaios
  @Post('fvm/lotes/:loteId/ensaios')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO')
  registrar(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Param('loteId', ParseIntPipe) loteId: number,
    @Body() dto: RegistrarEnsaioDto,
  ) {
    return this.ensaios.registrar(tenantId, loteId, user.id, dto);
  }

  // PATCH /fvm/ensaios/:ensaioId
  @Patch('fvm/ensaios/:ensaioId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO')
  atualizar(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Param('ensaioId', ParseIntPipe) ensaioId: number,
    @Body() dto: RegistrarEnsaioDto,
  ) {
    return this.ensaios.atualizar(tenantId, ensaioId, user.id, dto);
  }

  // DELETE /fvm/ensaios/:ensaioId
  @Delete('fvm/ensaios/:ensaioId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  remover(
    @TenantId() tenantId: number,
    @Param('ensaioId', ParseIntPipe) ensaioId: number,
  ) {
    return this.ensaios.remover(tenantId, ensaioId);
  }

  // GET /fvm/lotes/:loteId/ensaios/resultado
  @Get('fvm/lotes/:loteId/ensaios/resultado')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'LABORATORIO')
  resultado(
    @TenantId() tenantId: number,
    @Param('loteId', ParseIntPipe) loteId: number,
  ) {
    return this.ensaios.calcularResultadoLote(tenantId, loteId);
  }
}
