// backend/src/almoxarifado/estoque/estoque.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Req, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { EstoqueService } from './estoque.service';
import { CreateMovimentoDto } from './dto/create-movimento.dto';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  // ── Saldo ─────────────────────────────────────────────────────────────────

  @Get('estoque/saldo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getSaldo(
    @TenantId() tenantId: number,
    @Query('local_id')   localId?: string,
    @Query('tipo_local') tipoLocal?: string,
    @Query('catalogoId') catalogoId?: string,
    @Query('nivel')      nivel?: string,
  ) {
    return this.estoque.getSaldo(tenantId, {
      localId:    localId    ? Number(localId)    : undefined,
      tipoLocal,
      catalogoId: catalogoId ? Number(catalogoId) : undefined,
      nivel,
    });
  }

  // ── Movimentos ────────────────────────────────────────────────────────────

  @Get('estoque/movimentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getMovimentos(
    @TenantId() tenantId: number,
    @Query('local_id')   localId?: string,
    @Query('tipo_local') tipoLocal?: string,
    @Query('catalogoId') catalogoId?: string,
    @Query('tipo')       tipo?: string,
    @Query('limit')      limit?: string,
    @Query('offset')     offset?: string,
  ) {
    return this.estoque.getMovimentos(tenantId, {
      localId:    localId    ? Number(localId)    : undefined,
      tipoLocal,
      catalogoId: catalogoId ? Number(catalogoId) : undefined,
      tipo,
      limit:  limit  ? Number(limit)  : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('estoque/movimentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  registrarMovimento(
    @TenantId() tenantId: number,
    @Body() dto: CreateMovimentoDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.registrarMovimento(tenantId, dto.local_id, usuarioId, dto);
  }

  // ── Alertas ───────────────────────────────────────────────────────────────

  @Get('estoque/alertas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getAlertas(
    @TenantId() tenantId: number,
    @Query('local_id') localId?: string,
    @Query('todos')    todos?: string,
  ) {
    return this.estoque.getAlertas(
      tenantId,
      localId ? Number(localId) : undefined,
      todos !== 'true',
    );
  }

  @Patch('estoque/alertas/:id/ler')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  marcarAlertaLido(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) alertaId: number,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.marcarAlertaLido(tenantId, alertaId, usuarioId);
  }

  @Patch('estoque/alertas/ler-todos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  marcarTodosLidos(
    @TenantId() tenantId: number,
    @Req() req: any,
    @Query('local_id') localId?: string,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.marcarTodosLidos(
      tenantId,
      localId ? Number(localId) : undefined,
      usuarioId,
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getDashboard(
    @TenantId() tenantId: number,
    @Query('local_id') localId?: string,
  ) {
    return this.estoque.getDashboardKpis(tenantId, localId ? Number(localId) : undefined);
  }

  // ── Importação via planilha ───────────────────────────────────────────────

  @Get('estoque/importar/template')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  baixarTemplate(@Res() res: Response) {
    const buffer = this.estoque.gerarTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-estoque.xlsx"');
    res.send(buffer);
  }

  @Post('estoque/importar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  }))
  async importarPlanilha(
    @TenantId() tenantId: number,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('local_id') localIdStr: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') throw new BadRequestException('Apenas arquivos .xlsx são aceitos');

    const localId = Number(localIdStr);
    if (!localId || isNaN(localId)) throw new BadRequestException('local_id inválido');

    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.importarPlanilha(tenantId, localId, usuarioId, file.buffer);
  }
}
