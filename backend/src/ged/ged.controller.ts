// src/ged/ged.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { GedService } from './ged.service';
import { GedExportService } from './ged-export.service';
import { GedPastasService } from './pastas/pastas.service';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { ListDocumentosDto } from './dto/list-documentos.dto';
import { AprovarDto } from './dto/aprovar.dto';
import { RejeitarDto } from './dto/rejeitar.dto';
import { CancelarDto } from './dto/cancelar.dto';
import { CriarVersaoDto } from './dto/criar-versao.dto';
import { CreatePastaDto } from './dto/create-pasta.dto';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'desconhecido';
}

interface AuthRequest extends Request {
  user: { id: number; tenantId: number; roles: string[] };
}

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GedController {
  constructor(
    private readonly gedService: GedService,
    private readonly gedExportService: GedExportService,
    private readonly pastasService: GedPastasService,
  ) {}

  // ─── Categorias ───────────────────────────────────────────────────────────

  /** GET /api/v1/obras/:obraId/ged/categorias */
  @Get('obras/:obraId/ged/categorias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getCategoriasPorObra(
    @TenantId() tenantId: number,
  ) {
    return this.gedService.getCategorias(tenantId);
  }

  /** GET /api/v1/ged/categorias — nível empresa */
  @Get('ged/categorias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getCategorias(
    @TenantId() tenantId: number,
  ) {
    return this.gedService.getCategorias(tenantId);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  /** GET /api/v1/obras/:obraId/ged/stats */
  @Get('obras/:obraId/ged/stats')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getStats(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
  ) {
    return this.gedService.getStats(tenantId, obraId);
  }

  // ─── Upload de documento ──────────────────────────────────────────────────

  /**
   * POST /api/v1/obras/:obraId/ged/documentos
   * Campo do arquivo: "arquivo" (alinhado com o frontend)
   */
  @Post('obras/:obraId/ged/documentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @UseInterceptors(FileInterceptor('arquivo'))
  @HttpCode(HttpStatus.CREATED)
  async uploadDocumento(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentoDto,
  ) {
    return this.gedService.upload(tenantId, req.user.id, obraId, file, dto, getClientIp(req));
  }

  /**
   * POST /api/v1/ged/documentos
   * Upload de documento em escopo EMPRESA (sem obraId). A pasta e a categoria
   * referenciadas no DTO devem ser do escopo EMPRESA. O endpoint antigo
   * `POST /obras/:obraId/ged/documentos` permanece para escopo OBRA.
   * Apenas ADMIN_TENANT pode criar documentos corporativos.
   */
  @Post('ged/documentos')
  @Roles('ADMIN_TENANT')
  @UseInterceptors(FileInterceptor('arquivo'))
  @HttpCode(HttpStatus.CREATED)
  async uploadDocumentoEmpresa(
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentoDto,
  ) {
    return this.gedService.upload(
      tenantId,
      req.user.id,
      null,
      file,
      { ...dto, escopo: 'EMPRESA' },
      getClientIp(req),
    );
  }

  // ─── Listagem de documentos ───────────────────────────────────────────────

  /** GET /api/v1/ged/documentos — documentos nível empresa (escopo EMPRESA) */
  @Get('ged/documentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listarDocumentosEmpresa(
    @TenantId() tenantId: number,
    @Query() dto: ListDocumentosDto,
  ) {
    return this.gedService.listarDocumentos(tenantId, null, dto);
  }

  /** GET /api/v1/obras/:obraId/ged/documentos */
  @Get('obras/:obraId/ged/documentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listarDocumentos(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @Query() dto: ListDocumentosDto,
  ) {
    return this.gedService.listarDocumentos(tenantId, obraId, dto);
  }

  // ─── Detalhe da versão ────────────────────────────────────────────────────

  /** GET /api/v1/ged/versoes/:versaoId */
  @Get('ged/versoes/:versaoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getVersaoDetalhe(
    @Param('versaoId', ParseIntPipe) versaoId: number,
    @TenantId() tenantId: number,
  ) {
    return this.gedService.getVersaoDetalhe(tenantId, versaoId);
  }

  // ─── Download ─────────────────────────────────────────────────────────────

  /** GET /api/v1/ged/versoes/:versaoId/download */
  @Get('ged/versoes/:versaoId/download')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async download(
    @Param('versaoId', ParseIntPipe) versaoId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
  ) {
    return this.gedService.download(tenantId, req.user.id, versaoId, getClientIp(req));
  }

  // ─── Audit log ────────────────────────────────────────────────────────────

  /** GET /api/v1/ged/versoes/:versaoId/audit */
  @Get('ged/versoes/:versaoId/audit')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getAuditLog(
    @Param('versaoId', ParseIntPipe) versaoId: number,
    @TenantId() tenantId: number,
  ) {
    return this.gedService.getAuditLog(tenantId, versaoId);
  }

  // ─── Submeter (RASCUNHO → IFA) ────────────────────────────────────────────

  @Post('ged/versoes/:versaoId/submeter')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async submeter(
    @Param('versaoId', ParseIntPipe) versaoId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
  ) {
    return this.gedService.submeter(tenantId, req.user.id, versaoId, getClientIp(req));
  }

  // ─── Aprovar (IFA → IFC | IFP | AS_BUILT) ────────────────────────────────

  @Post('ged/versoes/:versaoId/aprovar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async aprovar(
    @Param('versaoId', ParseIntPipe) versaoId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
    @Body() dto: AprovarDto,
  ) {
    return this.gedService.aprovar(tenantId, req.user.id, versaoId, dto, getClientIp(req));
  }

  // ─── Rejeitar (IFA → REJEITADO) ───────────────────────────────────────────

  @Post('ged/versoes/:versaoId/rejeitar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async rejeitar(
    @Param('versaoId', ParseIntPipe) versaoId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
    @Body() dto: RejeitarDto,
  ) {
    return this.gedService.rejeitar(tenantId, req.user.id, versaoId, dto, getClientIp(req));
  }

  // ─── Retornar para Rascunho (REJEITADO → RASCUNHO) ────────────────────────
  // Permite ao autor corrigir após rejeição e ressubmeter.

  @Post('ged/versoes/:versaoId/marcar-rascunho')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async marcarRascunho(
    @Param('versaoId', ParseIntPipe) versaoId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
  ) {
    return this.gedService.marcarRascunho(tenantId, req.user.id, versaoId, getClientIp(req));
  }

  // ─── Cancelar versão (qualquer não-final → CANCELADO) ─────────────────────

  @Post('ged/versoes/:versaoId/cancelar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async cancelar(
    @Param('versaoId', ParseIntPipe) versaoId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
    @Body() dto: CancelarDto,
  ) {
    return this.gedService.cancelar(tenantId, req.user.id, versaoId, dto.motivo, getClientIp(req));
  }

  // ─── Nova versão de documento existente (POST multipart) ──────────────────
  // Faz upload de uma revisão nova sobre um documento já cadastrado. A versão
  // anterior continua no ar até que esta seja aprovada (`aprovar` dispara
  // `obsoletarVersoesAnteriores` automaticamente).

  @Post('ged/documentos/:documentoId/versoes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @UseInterceptors(FileInterceptor('arquivo'))
  @HttpCode(HttpStatus.CREATED)
  async criarNovaVersao(
    @Param('documentoId', ParseIntPipe) documentoId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CriarVersaoDto,
  ) {
    return this.gedService.novaVersao(
      tenantId,
      req.user.id,
      documentoId,
      file,
      dto,
      getClientIp(req),
    );
  }

  // ─── Lista Mestra ─────────────────────────────────────────────────────────

  @Get('obras/:obraId/ged/lista-mestra')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listaMestra(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
  ) {
    // Endpoint consumido pelo frontend GedListaMestraPage — shape agrupado por
    // categoria. O método `listaMestra` flat continua sendo usado pelo serviço
    // de export PDF/XLSX (GedExportService), mantendo compatibilidade.
    return this.gedService.listaMestraAgrupada(tenantId, obraId);
  }

  /** GET /api/v1/obras/:obraId/ged/lista-mestra/export/pdf — download PDF */
  @Get('obras/:obraId/ged/lista-mestra/export/pdf')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async exportListaMestraPdf(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.gedExportService.gerarPdfListaMestra(tenantId, obraId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="lista-mestra-obra-${obraId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /** GET /api/v1/obras/:obraId/ged/lista-mestra/export/xlsx — download XLSX */
  @Get('obras/:obraId/ged/lista-mestra/export/xlsx')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async exportListaMestraXlsx(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.gedExportService.gerarXlsxListaMestra(tenantId, obraId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="lista-mestra-obra-${obraId}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  // ─── QR Code (público, sem JWT) ───────────────────────────────────────────
  // Rate-limit agressivo por IP para frear brute-force no qrToken.

  @Get('ged/qr/:qrToken')
  @UseGuards()
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 100, ttl: 3_600_000 },
  })
  async consultaQr(
    @Param('qrToken') qrToken: string,
    @Req() req: Request,
  ) {
    const ip =
      typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.socket.remoteAddress ?? 'desconhecido';
    return this.gedService.consultaQr(qrToken, ip);
  }

  // ─── Pastas ───────────────────────────────────────────────────────────────

  @Get('obras/:obraId/ged/pastas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listarPastas(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
  ) {
    return this.pastasService.listarPastas(tenantId, obraId);
  }

  /**
   * GET /api/v1/ged/pastas — lista pastas de escopo EMPRESA (obra_id IS NULL).
   * Complementa /ged/categorias para permitir upload sem obra via GedAdminPage.
   */
  @Get('ged/pastas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listarPastasEmpresa(
    @TenantId() tenantId: number,
  ) {
    return this.pastasService.listarPastasEmpresa(tenantId);
  }

  @Post('obras/:obraId/ged/pastas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  async criarPasta(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @Req() req: AuthRequest,
    @Body() dto: CreatePastaDto,
  ) {
    return this.pastasService.criarPasta(tenantId, obraId, req.user.id, dto);
  }
}
