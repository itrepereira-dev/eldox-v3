import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { ObrasService } from './obras.service';
import { CreateObraDto } from './dto/create-obra.dto';
import { UpdateObraDto } from './dto/update-obra.dto';
import { CreateObraLocalDto } from './dto/create-obra-local.dto';
import { UpdateObraLocalDto } from './dto/update-obra-local.dto';
import { GerarMassaDto } from './dto/gerar-massa.dto';
import { CreateObraTipoDto } from './dto/create-obra-tipo.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObrasController {
  constructor(private readonly obrasService: ObrasService) {}

  // ─────────────────────────────────────────
  // OBRA TIPOS
  // ─────────────────────────────────────────

  @Get('obra-tipos')
  findAllTipos(@TenantId() tenantId: number) {
    return this.obrasService.findAllTipos(tenantId);
  }

  @Post('obra-tipos')
  @Roles('ADMIN_TENANT' as any)
  createTipo(@TenantId() tenantId: number, @Body() dto: CreateObraTipoDto) {
    return this.obrasService.createTipo(tenantId, dto);
  }

  // ─────────────────────────────────────────
  // OBRAS
  // ─────────────────────────────────────────

  @Get('obras')
  findAll(
    @TenantId() tenantId: number,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.obrasService.findAll(tenantId, {
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Post('obras')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  @HttpCode(HttpStatus.CREATED)
  create(@TenantId() tenantId: number, @Body() dto: CreateObraDto) {
    return this.obrasService.create(tenantId, dto);
  }

  @Get('obras/:id')
  findOne(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.obrasService.findOne(tenantId, id);
  }

  @Put('obras/:id')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  update(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateObraDto,
  ) {
    return this.obrasService.update(tenantId, id, dto);
  }

  @Delete('obras/:id')
  @Roles('ADMIN_TENANT' as any)
  @HttpCode(HttpStatus.OK)
  remove(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.obrasService.remove(tenantId, id);
  }

  // ─────────────────────────────────────────
  // OBRA LOCAIS
  // ─────────────────────────────────────────

  @Get('obras/:id/locais')
  findLocais(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @Query('parentId') parentId?: string,
    @Query('nivel') nivel?: string,
  ) {
    return this.obrasService.findLocais(tenantId, obraId, {
      parentId: parentId !== undefined ? (parentId === 'null' ? null : parseInt(parentId)) : undefined,
      nivel: nivel ? parseInt(nivel) : undefined,
    });
  }

  @Post('obras/:id/locais')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  @HttpCode(HttpStatus.CREATED)
  createLocal(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @Body() dto: CreateObraLocalDto,
  ) {
    return this.obrasService.createLocal(tenantId, obraId, dto);
  }

  @Post('obras/:id/locais/gerar-massa')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  @HttpCode(HttpStatus.CREATED)
  gerarMassa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @Body() dto: GerarMassaDto,
  ) {
    return this.obrasService.gerarMassa(tenantId, obraId, dto);
  }

  // GAP-06: Atualizar local de obra
  @Put('obras/:id/locais/:localId')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  updateLocal(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @Param('localId', ParseIntPipe) localId: number,
    @Body() dto: UpdateObraLocalDto,
  ) {
    return this.obrasService.updateLocal(tenantId, obraId, localId, dto);
  }

  @Delete('obras/:id/locais/:localId')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  removeLocal(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @Param('localId', ParseIntPipe) localId: number,
  ) {
    return this.obrasService.removeLocal(tenantId, obraId, localId);
  }
}
