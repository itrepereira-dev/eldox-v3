// backend/src/ncs/ncs.controller.ts
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
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../common/decorators/tenant.decorator';
import { NcsService } from './ncs.service';
import { NcEvidenciaService } from './nc-evidencia.service';
import { CreateNcDto } from './dto/create-nc.dto';
import { UpdateNcDto } from './dto/update-nc.dto';

interface JwtUser {
  id: number;
  tenantId: number;
  role: string;
}

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NcsController {
  constructor(
    private readonly ncs: NcsService,
    private readonly ncEvidencia: NcEvidenciaService,
  ) {}

  // ── GET /obras/:obraId/ncs — listar NCs por obra ─────────────────────────

  @Get('obras/:obraId/ncs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listarPorObra(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('status') status?: string,
    @Query('categoria') categoria?: string,
    @Query('criticidade') criticidade?: string,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.ncs.listar(tenantId, obraId, { status, categoria, criticidade, search, page, limit });
  }

  // ── GET /ncs — listar NCs cross-obra (painel global) ─────────────────────

  @Get('ncs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listarGlobal(
    @TenantId() tenantId: number,
    @Query('status') status?: string,
    @Query('categoria') categoria?: string,
    @Query('criticidade') criticidade?: string,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.ncs.listar(tenantId, undefined, { status, categoria, criticidade, search, page, limit });
  }

  // ── GET /ncs/:ncId — detalhe ──────────────────────────────────────────────

  @Get('ncs/:ncId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  buscar(
    @TenantId() tenantId: number,
    @Param('ncId', ParseIntPipe) ncId: number,
  ) {
    return this.ncs.buscar(tenantId, ncId);
  }

  // ── POST /obras/:obraId/ncs — criar NC manual ─────────────────────────────

  @Post('obras/:obraId/ncs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Body() dto: CreateNcDto,
  ) {
    return this.ncs.criar(tenantId, user.id, obraId, dto);
  }

  // ── PATCH /ncs/:ncId — atualizar ──────────────────────────────────────────

  @Patch('ncs/:ncId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  atualizar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('ncId', ParseIntPipe) ncId: number,
    @Body() dto: UpdateNcDto,
  ) {
    return this.ncs.atualizar(tenantId, ncId, user.id, dto);
  }

  // ── POST /ncs/:ncId/evidencia/upload — upload direto de foto/PDF ──────────
  //
  // Aceita JPG/PNG/WebP/HEIC/PDF até 10 MB. Persiste no GED (categoria
  // EVIDENCIA_NC) e atualiza nao_conformidades.ged_versao_id + evidencia_url.
  // Substitui evidência anterior (1 doc GED vivo por NC); versões antigas
  // ficam no GED sem referência.
  @Post('ncs/:ncId/evidencia/upload')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/i.test(file.mimetype);
        cb(
          ok ? null : new BadRequestException('Tipo não permitido. Use JPG, PNG, WebP, HEIC ou PDF.'),
          ok,
        );
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  uploadEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('ncId', ParseIntPipe) ncId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    return this.ncEvidencia.uploadEvidencia(tenantId, ncId, user.id, file);
  }

  // ── DELETE /ncs/:ncId — soft delete ───────────────────────────────────────

  @Delete('ncs/:ncId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  deletar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('ncId', ParseIntPipe) ncId: number,
  ) {
    return this.ncs.deletar(tenantId, ncId, user.id);
  }
}
