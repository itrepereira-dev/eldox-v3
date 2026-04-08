import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CatalogoService } from './catalogo.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { CreateServicoDto } from './dto/create-servico.dto';
import { UpdateServicoDto } from './dto/update-servico.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ReorderDto } from './dto/reorder.dto';
import { ImportQueryDto } from './dto/import-query.dto';

@Controller('api/v1/fvs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  // ─────────────────────────────────────────
  // CATEGORIAS
  // ─────────────────────────────────────────

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

  // IMPORTANT: /categorias/ordem must come BEFORE /categorias/:id to avoid route conflict
  @Patch('categorias/ordem')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  reordenarCategorias(@TenantId() tenantId: number, @Body() dto: ReorderDto) {
    return this.catalogo.reordenarCategorias(tenantId, dto.itens);
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
  deleteCategoria(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.deleteCategoria(tenantId, id);
  }

  // ─────────────────────────────────────────
  // SERVIÇOS
  // ─────────────────────────────────────────

  @Get('servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getServicos(
    @TenantId() tenantId: number,
    @Query('categoriaId', new ParseIntPipe({ optional: true })) categoriaId?: number,
  ) {
    return this.catalogo.getServicos(tenantId, categoriaId);
  }

  @Get('servicos/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getServico(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.getServico(tenantId, id);
  }

  // IMPORTANT: /servicos/importar must come BEFORE /servicos/:id/clonar
  @Post('servicos/importar')
  @Roles('ADMIN_TENANT')
  @UseInterceptors(FileInterceptor('arquivo'))
  importarCsv(
    @TenantId() tenantId: number,
    @UploadedFile() file: Express.Multer.File,
    @Query() query: ImportQueryDto,
  ) {
    if (!file) throw new BadRequestException('Arquivo CSV obrigatório');
    return this.catalogo.importarCsv(tenantId, file.buffer, query.dry_run ?? false);
  }

  @Post('servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createServico(@TenantId() tenantId: number, @Body() dto: CreateServicoDto) {
    return this.catalogo.createServico(tenantId, dto);
  }

  @Post('servicos/:id/clonar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  clonarServico(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.clonarServico(tenantId, id);
  }

  @Patch('servicos/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServicoDto,
  ) {
    return this.catalogo.updateServico(tenantId, id, dto);
  }

  @Delete('servicos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteServico(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.deleteServico(tenantId, id);
  }

  // ─────────────────────────────────────────
  // ITENS
  // ─────────────────────────────────────────

  @Post('servicos/:id/itens')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createItem(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) servicoId: number,
    @Body() dto: CreateItemDto,
  ) {
    return this.catalogo.createItem(tenantId, servicoId, dto);
  }

  @Patch('servicos/:id/itens/ordem')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  reordenarItens(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) servicoId: number,
    @Body() dto: ReorderDto,
  ) {
    return this.catalogo.reordenarItens(tenantId, servicoId, dto.itens);
  }

  @Patch('itens/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateItem(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
  ) {
    return this.catalogo.updateItem(tenantId, id, dto);
  }

  @Delete('itens/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.deleteItem(tenantId, id);
  }
}
