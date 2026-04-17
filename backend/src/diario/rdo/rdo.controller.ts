// backend/src/diario/rdo/rdo.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RdoService, ListRdosQuery } from './rdo.service';
import { RdoIaService } from './rdo-ia.service';
import { RdoPdfService } from './rdo-pdf.service';
import { RdoFotosService } from './rdo-fotos.service';
import { RdoExportService } from './rdo-export.service';
import { RdoAvancoService } from './rdo-avanco.service';
import { CreateRdoDto } from './dto/create-rdo.dto';
import { UpdateRdoDto } from './dto/update-rdo.dto';
import { UpdateClimaDto } from './dto/update-clima.dto';
import { UpdateMaoObraDto } from './dto/update-mao-obra.dto';
import { UpdateEquipamentosDto } from './dto/update-equipamentos.dto';
import { UpdateAtividadesDto } from './dto/update-atividades.dto';
import { UpdateOcorrenciasDto } from './dto/update-ocorrencias.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { StatusRdoDto } from './dto/status-rdo.dto';
import { AplicarSugestaoDto } from './dto/aplicar-sugestao.dto';

interface JwtUser {
  id: number;
  tenantId: number;
  role: string;
}

@Controller('api/v1/diario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RdoController {
  private readonly logger = new Logger(RdoController.name);

  constructor(
    private readonly rdoService: RdoService,
    private readonly rdoIaService: RdoIaService,
    private readonly rdoPdfService: RdoPdfService,
    private readonly rdoFotosService: RdoFotosService,
    private readonly rdoExportService: RdoExportService,
    private readonly rdoAvancoService: RdoAvancoService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Grupo 1: CRUD de RDOs ────────────────────────────────────────────────

  /**
   * POST /api/v1/diario/rdos
   * Cria novo RDO e aciona pipeline de agentes IA (async via BullMQ)
   */
  @Post('rdos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateRdoDto,
  ) {
    return this.rdoService.create(tenantId, user.id, dto);
  }

  /**
   * GET /api/v1/diario/rdos
   * Lista RDOs com filtros e paginação — obra_id obrigatório
   */
  @Get('rdos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async list(
    @TenantId() tenantId: number,
    @Query('obra_id', new ParseIntPipe({ optional: false })) obra_id: number,
    @Query('status') status?: string,
    @Query('data_inicio') data_inicio?: string,
    @Query('data_fim') data_fim?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const query: ListRdosQuery = {
      obra_id,
      status,
      data_inicio,
      data_fim,
      page,
      limit,
    };
    return this.rdoService.list(tenantId, query);
  }

  /**
   * GET /api/v1/diario/rdos/:id
   * Retorna RDO completo com todas as seções
   */
  @Get('rdos/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async findById(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdoService.findById(tenantId, id);
  }

  /**
   * PATCH /api/v1/diario/rdos/:id
   * Atualiza campos raiz do RDO (parcial) — bloqueado se aprovado
   */
  @Patch('rdos/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async update(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRdoDto,
  ) {
    return this.rdoService.update(tenantId, user.id, id, dto);
  }

  /**
   * DELETE /api/v1/diario/rdos/:id
   * Soft delete — só permitido se status = 'preenchendo'
   */
  @Delete('rdos/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdoService.remove(tenantId, user.id, user.role, id);
  }

  // ─── Grupo 2: Workflow de Status ─────────────────────────────────────────

  /**
   * PATCH /api/v1/diario/rdos/:id/status
   * Avança status: preenchendo→revisao | revisao→aprovado
   */
  @Patch('rdos/:id/status')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async updateStatus(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StatusRdoDto,
  ) {
    return this.rdoService.updateStatus(tenantId, user.id, user.role, id, dto);
  }

  // ─── Grupo 3: Seções do RDO ───────────────────────────────────────────────

  /**
   * PUT /api/v1/diario/rdos/:id/clima
   * Upsert dos 3 períodos climáticos
   */
  @Put('rdos/:id/clima')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async putClima(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClimaDto,
  ) {
    return this.rdoService.upsertClima(tenantId, user.id, id, dto);
  }

  /**
   * PUT /api/v1/diario/rdos/:id/mao-de-obra
   * Substitui todos os itens de mão de obra
   */
  @Put('rdos/:id/mao-de-obra')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async putMaoObra(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaoObraDto,
  ) {
    return this.rdoService.substituirMaoObra(tenantId, user.id, id, dto);
  }

  /**
   * PUT /api/v1/diario/rdos/:id/equipamentos
   * Substitui todos os equipamentos
   */
  @Put('rdos/:id/equipamentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async putEquipamentos(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEquipamentosDto,
  ) {
    return this.rdoService.substituirEquipamentos(tenantId, user.id, id, dto);
  }

  /**
   * PUT /api/v1/diario/rdos/:id/atividades
   * Substitui todas as atividades
   */
  @Put('rdos/:id/atividades')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async putAtividades(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAtividadesDto,
  ) {
    return this.rdoService.substituirAtividades(tenantId, user.id, id, dto);
  }

  /**
   * PUT /api/v1/diario/rdos/:id/ocorrencias
   * Substitui todas as ocorrências
   */
  @Put('rdos/:id/ocorrencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async putOcorrencias(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOcorrenciasDto,
  ) {
    return this.rdoService.substituirOcorrencias(tenantId, user.id, id, dto);
  }

  /**
   * PUT /api/v1/diario/rdos/:id/checklist
   * Substitui todos os itens de checklist
   */
  @Put('rdos/:id/checklist')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async putChecklist(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.rdoService.substituirChecklist(tenantId, user.id, id, dto);
  }

  // ─── Grupo 4: Ações de IA ─────────────────────────────────────────────────

  /**
   * POST /api/v1/diario/rdos/:id/validar
   * Aciona AGENTE-VALIDADOR — retorna inconsistências SEM salvar
   */
  @Post('rdos/:id/validar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async validar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdoIaService.validarRdo(id, tenantId);
  }

  /**
   * GET /api/v1/diario/rdos/:id/sugestoes
   * Retorna sugestões IA pendentes (acao IS NULL) para o RDO
   */
  @Get('rdos/:id/sugestoes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getSugestoes(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdoIaService.buscarSugestoesPendentes(id, tenantId);
  }

  /**
   * POST /api/v1/diario/rdos/:id/aplicar-sugestao
   * Registra que usuário aplicou/ignorou/editou uma sugestão IA
   */
  @Post('rdos/:id/aplicar-sugestao')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async aplicarSugestao(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AplicarSugestaoDto,
  ) {
    await this.rdoIaService.registrarAcaoSugestao(id, tenantId, user.id, dto);
    return { ok: true };
  }

  // ─── Grupo 5: Inteligência da Obra ────────────────────────────────────────

  /**
   * GET /api/v1/diario/obras/:obraId/inteligencia
   * Retorna painel de inteligência IA da obra
   */
  @Get('obras/:obraId/inteligencia')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getInteligencia(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.rdoService.getInteligenciaObra(tenantId, obraId);
  }

  /**
   * GET /api/v1/diario/obras/:obraId/alertas
   * Retorna alertas ativos do tenant (tenant-wide, obraId ignorado)
   */
  @Get('obras/:obraId/alertas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getAlertas(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.rdoIaService.getAlertasObra(tenantId, user.id);
  }

  // ─── Grupo 6: Sprint B1 — Fotos ──────────────────────────────────────────

  /**
   * POST /api/v1/diario/rdos/:id/fotos
   * Upload de foto (base64) associada ao RDO
   */
  @Post('rdos/:id/fotos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async uploadFoto(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { base64: string; mime_type: string; legenda?: string },
  ) {
    return this.rdoFotosService.uploadFoto(
      tenantId,
      id,
      user.id,
      body.base64,
      body.mime_type,
      body.legenda,
    );
  }

  /**
   * GET /api/v1/diario/rdos/:id/fotos
   * Lista fotos de um RDO
   */
  @Get('rdos/:id/fotos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listarFotos(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdoFotosService.listar(tenantId, id);
  }

  /**
   * DELETE /api/v1/diario/rdos/:id/fotos/:fotoId
   * Remove foto do RDO
   */
  @Delete('rdos/:id/fotos/:fotoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluirFoto(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.rdoFotosService.excluir(tenantId, id, fotoId, user.id);
  }

  /**
   * PATCH /api/v1/diario/rdos/:id/fotos/:fotoId
   * Atualiza a legenda da foto (QW6 — caption editável).
   */
  @Patch('rdos/:id/fotos/:fotoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async atualizarLegendaFoto(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('fotoId', ParseIntPipe) fotoId: number,
    @Body() body: { legenda: string },
  ) {
    return this.rdoFotosService.atualizarLegenda(
      tenantId,
      id,
      fotoId,
      body.legenda ?? '',
    );
  }

  // ─── Grupo 7: Sprint B1 — Exportação XLS ─────────────────────────────────

  /**
   * GET /api/v1/diario/rdos/:id/exportar-xls
   * Download XLS de um RDO individual
   */
  @Get('rdos/:id/exportar-xls')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async exportarRdoXls(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const buffer = await this.rdoExportService.exportarRdoIndividual(tenantId, id);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="RDO-${id}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /**
   * GET /api/v1/diario/obras/:obraId/exportar-xls
   * Download XLS com resumo do período (data_inicio + data_fim obrigatórios)
   */
  @Get('obras/:obraId/exportar-xls')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async exportarResumoXls(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('data_inicio') dataInicio: string,
    @Query('data_fim') dataFim: string,
    @Res() res: Response,
  ) {
    const buffer = await this.rdoExportService.exportarResumoPeriodo(tenantId, obraId, dataInicio, dataFim);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Diario-Obra-${obraId}-${dataInicio}-${dataFim}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /**
   * GET /api/v1/diario/obras/:obraId/exportar-horas
   * Download XLS com horas por função no período
   */
  @Get('obras/:obraId/exportar-horas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async exportarHorasXls(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('data_inicio') dataInicio: string,
    @Query('data_fim') dataFim: string,
    @Res() res: Response,
  ) {
    const buffer = await this.rdoExportService.exportarHorasPorFuncao(tenantId, obraId, dataInicio, dataFim);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Horas-Obra-${obraId}-${dataInicio}-${dataFim}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  // ─── Grupo 8: Sprint B1 — PDF + Compartilhamento com Cliente ─────────────

  /**
   * GET /api/v1/diario/rdos/:id/pdf
   * Download PDF do RDO (inclui fotos se ?fotos=true)
   */
  @Get('rdos/:id/pdf')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async downloadPdf(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('fotos') fotos: string,
    @Res() res: Response,
  ) {
    const incluirFotos = fotos === 'true' || fotos === '1';
    const buffer = await this.rdoPdfService.gerarPdf(id, tenantId, incluirFotos);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="RDO-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /**
   * PATCH /api/v1/diario/rdos/:id/compartilhar
   * Gera token_cliente para compartilhamento público
   * Body: { expira_em_dias?: number } (padrão: 7)
   */
  @Patch('rdos/:id/compartilhar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async compartilhar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { expira_em_dias?: number },
  ) {
    const dias = body.expira_em_dias ?? 7;
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + dias * 24 * 3600 * 1000);

    await this.prisma.$executeRawUnsafe(
      `UPDATE rdos SET token_cliente = $1, token_cliente_expires_at = $2 WHERE id = $3 AND tenant_id = $4`,
      token,
      expiresAt,
      id,
      tenantId,
    );

    const baseUrl = process.env.APP_URL ?? 'http://localhost:3001';
    return { token, link: `${baseUrl}/relatorio-cliente/${token}`, expira_em: expiresAt };
  }

  // ─── Grupo 9: Sprint B2 — Avanço Físico ──────────────────────────────────

  /**
   * GET /api/v1/diario/obras/:obraId/avanco-fisico
   * Retorna avanço físico por item de orçamento
   */
  @Get('obras/:obraId/avanco-fisico')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getAvancoFisico(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.rdoAvancoService.getAvancoFisico(tenantId, obraId);
  }

  /**
   * GET /api/v1/diario/obras/:obraId/previsto-realizado
   * Retorna comparativo previsto × realizado por dia
   */
  @Get('obras/:obraId/previsto-realizado')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getPrevistoRealizado(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('data_inicio') dataInicio: string,
    @Query('data_fim') dataFim: string,
  ) {
    return this.rdoAvancoService.getPrevistoRealizado(tenantId, obraId, dataInicio, dataFim);
  }

  /**
   * PATCH /api/v1/diario/rdos/:id/atividades/:atividadeId/quantidade
   * Registra quantidade executada linkada ao orçamento
   */
  @Patch('rdos/:id/atividades/:atividadeId/quantidade')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async registrarQuantidade(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('atividadeId', ParseIntPipe) atividadeId: number,
    @Body() body: { orcamento_item_id: number; quantidade_executada: number },
  ) {
    await this.rdoAvancoService.registrarQuantidadeExecutada(
      tenantId,
      id,
      atividadeId,
      body.orcamento_item_id,
      body.quantidade_executada,
    );
    return { ok: true };
  }

  /**
   * POST /api/v1/diario/rdos/:id/sincronizar-efetivo
   * Copia mão de obra do RDO para o módulo de efetivo
   */
  @Post('rdos/:id/sincronizar-efetivo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async sincronizarEfetivo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.rdoAvancoService.sincronizarComEfetivo(tenantId, id, user.id);
  }
}
