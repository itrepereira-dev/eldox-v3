import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Optional,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ObrasService } from './obras.service';
import { ModeloService } from '../fvs/modelos/modelo.service';
import { CreateObraDto } from './dto/create-obra.dto';
import { UpdateObraDto } from './dto/update-obra.dto';
import { CreateObraLocalDto } from './dto/create-obra-local.dto';
import { UpdateObraLocalDto } from './dto/update-obra-local.dto';
import { GerarMassaDto } from './dto/gerar-massa.dto';
import { GerarCascataDto } from './dto/gerar-cascata.dto';
import { CreateObraTipoDto } from './dto/create-obra-tipo.dto';
import { UpsertNivelConfigDto } from './dto/nivel-config.dto';
import { UpsertQualityConfigDto } from './dto/quality-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObrasController {
  constructor(
    private readonly obrasService: ObrasService,
    private readonly modeloService: ModeloService,
  ) {}

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

  @Post('obras/:id/foto-capa')
  @Roles('TECNICO' as any, 'ENGENHEIRO' as any, 'ADMIN_TENANT' as any, 'SUPER_ADMIN' as any)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  uploadFotoCapa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    return this.obrasService.uploadFotoCapa(tenantId, obraId, file);
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
  // OBRA NÍVEIS CONFIG
  // ─────────────────────────────────────────

  @Patch('obras/:id/niveis-config')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  saveNiveisConfig(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @Body() body: { niveis: UpsertNivelConfigDto[] },
  ) {
    return this.obrasService.saveNiveisConfig(tenantId, obraId, body.niveis);
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
    @Query('search') search?: string,
  ) {
    return this.obrasService.findLocais(tenantId, obraId, {
      parentId: parentId !== undefined ? (parentId === 'null' ? null : parseInt(parentId)) : undefined,
      nivel: nivel ? parseInt(nivel) : undefined,
      search: search || undefined,
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

  @Post('obras/:id/locais/gerar-cascata')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  @HttpCode(HttpStatus.CREATED)
  gerarCascata(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @Body() dto: GerarCascataDto,
  ) {
    return this.obrasService.gerarCascata(tenantId, obraId, dto);
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

  // ─────────────────────────────────────────
  // OBRA QUALITY CONFIG
  // ─────────────────────────────────────────

  @Get('obras/:id/quality-config')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any, 'TECNICO' as any)
  getQualityConfig(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
  ) {
    return this.obrasService.getQualityConfig(tenantId, obraId);
  }

  @Put('obras/:id/quality-config')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  upsertQualityConfig(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) obraId: number,
    @Body() dto: UpsertQualityConfigDto,
  ) {
    return this.obrasService.upsertQualityConfig(tenantId, obraId, dto);
  }

  // ─────────────────────────────────────────
  // OBRA MODELOS (FVS templates)
  // ─────────────────────────────────────────

  @Get('obras/:obraId/modelos')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any, 'TECNICO' as any, 'VISITANTE' as any)
  getModelosByObra(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.modeloService.getModelosByObra(tenantId, obraId);
  }

  @Delete('obras/:obraId/modelos/:modeloId')
  @Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
  @HttpCode(HttpStatus.NO_CONTENT)
  desvincularModelo(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('modeloId', ParseIntPipe) modeloId: number,
  ) {
    return this.modeloService.desvincularObra(tenantId, modeloId, obraId);
  }
}
