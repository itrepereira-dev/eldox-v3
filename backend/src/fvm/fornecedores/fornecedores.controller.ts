// backend/src/fvm/fornecedores/fornecedores.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe,
  UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FornecedoresService } from './fornecedores.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { CreateFornecedorRapidoDto } from './dto/create-fornecedor-rapido.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { PatchScoreDto } from './dto/patch-score.dto';

@Controller('api/v1/fvm/fornecedores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FornecedoresController {
  constructor(private readonly service: FornecedoresService) {}

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFornecedores(
    @TenantId() tenantId: number,
    @Query('situacao') situacao?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getFornecedores(tenantId, { situacao, search });
  }

  /** GET /fvm/fornecedores/performance — aggregated performance data for R-FVM3 */
  @Get('performance')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getPerformance(
    @TenantId() tenantId: number,
    @Query('obra_id') obraId?: string,
    @Query('data_inicio') dataInicio?: string,
    @Query('data_fim') dataFim?: string,
  ) {
    return this.service.getPerformance(tenantId, {
      obraId:     obraId     ? Number(obraId) : undefined,
      dataInicio,
      dataFim,
    });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFornecedor(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getFornecedor(tenantId, id);
  }

  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createFornecedor(
    @TenantId() tenantId: number,
    @Req() req: any,
    @Body() dto: CreateFornecedorDto,
  ) {
    return this.service.createFornecedor(tenantId, req.user.id, dto);
  }

  /** POST /fvm/fornecedores/rapido — criação inline no modal de nova entrega */
  @Post('rapido')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  createFornecedorRapido(
    @TenantId() tenantId: number,
    @Req() req: any,
    @Body() dto: CreateFornecedorRapidoDto,
  ) {
    return this.service.createFornecedorRapido(tenantId, req.user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateFornecedor(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFornecedorDto,
  ) {
    return this.service.updateFornecedor(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFornecedor(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteFornecedor(tenantId, id);
  }

  /** PATCH /fvm/fornecedores/:id/score — save computed performance score */
  @Patch(':id/score')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  patchScore(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchScoreDto,
  ) {
    return this.service.patchScore(tenantId, id, dto.score);
  }
}
