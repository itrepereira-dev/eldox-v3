// backend/src/fvm/catalogo/catalogo.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CatalogoFvmService } from './catalogo.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CreateItemDto } from './dto/create-item.dto';

@Controller('api/v1/fvm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogoFvmController {
  constructor(private readonly catalogo: CatalogoFvmService) {}

  // ── Categorias ─────────────────────────────────────────────────────────────

  @Get('categorias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getCategorias(@TenantId() tenantId: number) {
    return this.catalogo.getCategorias(tenantId);
  }

  @Post('categorias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createCategoria(@TenantId() tenantId: number, @Body() dto: CreateCategoriaDto) {
    return this.catalogo.createCategoria(tenantId, dto);
  }

  @Patch('categorias/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateCategoria(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.catalogo.updateCategoria(tenantId, id, dto);
  }

  @Delete('categorias/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategoria(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalogo.deleteCategoria(tenantId, id);
  }

  // ── Materiais ──────────────────────────────────────────────────────────────

  @Get('materiais')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getMateriais(
    @TenantId() tenantId: number,
    @Query('categoriaId') categoriaId?: string,
  ) {
    return this.catalogo.getMateriais(tenantId, categoriaId ? Number(categoriaId) : undefined);
  }

  @Get('materiais/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getMaterial(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalogo.getMaterial(tenantId, id);
  }

  @Post('materiais')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createMaterial(@TenantId() tenantId: number, @Body() dto: CreateMaterialDto) {
    return this.catalogo.createMaterial(tenantId, dto);
  }

  @Patch('materiais/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateMaterial(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.catalogo.updateMaterial(tenantId, id, dto);
  }

  @Delete('materiais/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMaterial(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalogo.deleteMaterial(tenantId, id);
  }

  // ── Itens de verificação ───────────────────────────────────────────────────

  @Post('materiais/:id/itens')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createItem(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) materialId: number,
    @Body() dto: CreateItemDto,
  ) {
    return this.catalogo.createItem(tenantId, materialId, dto);
  }

  @Patch('itens/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateItem(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() dto: Partial<CreateItemDto> & { ativo?: boolean },
  ) {
    return this.catalogo.updateItem(tenantId, itemId, dto);
  }

  @Delete('itens/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) itemId: number,
  ) {
    return this.catalogo.deleteItem(tenantId, itemId);
  }
}
