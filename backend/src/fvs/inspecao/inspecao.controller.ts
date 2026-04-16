// backend/src/fvs/inspecao/inspecao.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Put, Body, Param, Query,
  ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, Ip, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { InspecaoService } from './inspecao.service';
import { ParecerService } from './parecer.service';
import { CreateFichaDto } from './dto/create-ficha.dto';
import { UpdateFichaDto } from './dto/update-ficha.dto';
import { PutRegistroDto } from './dto/put-registro.dto';
import { UpdateLocalDto } from './dto/update-local.dto';
import { AddServicoDto } from './dto/add-servico.dto';
import { SubmitParecerDto } from './dto/submit-parecer.dto';
import { BulkInspecaoDto } from './dto/bulk-inspecao.dto';
import { RegistrarTratamentoDto } from './dto/registrar-tratamento.dto';
import { AgenteDiagnosticoNc } from '../../ai/agents/fvs/agente-diagnostico-nc';
import { AgentePreditorNc } from '../../ai/agents/fvs/agente-preditor-nc';
import { AgenteAnaliseFoto } from '../../ai/agents/fvs/agente-analise-foto';
import { PrismaService } from '../../prisma/prisma.service';
import { FvsPdfService } from '../pdf/fvs-pdf.service';
import type { Response } from 'express';
import { Res } from '@nestjs/common';
import * as crypto from 'crypto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/fvs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InspecaoController {
  constructor(
    private readonly inspecao: InspecaoService,
    private readonly parecer: ParecerService,
    private readonly diagnosticoNc: AgenteDiagnosticoNc,
    private readonly preditorNc: AgentePreditorNc,
    private readonly analiseFoto: AgenteAnaliseFoto,
    private readonly prisma: PrismaService,
    private readonly fvsPdf: FvsPdfService,
  ) {}

  // ─── Fichas ─────────────────────────────────────────────────────────────────

  @Post('fichas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createFicha(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFichaDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.createFicha(tenantId, user.id, dto, ip);
  }

  @Get('fichas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFichas(
    @TenantId() tenantId: number,
    @Query('obraId', new ParseIntPipe({ optional: true })) obraId?: number,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.inspecao.getFichas(tenantId, obraId, page, limit);
  }

  @Get('fichas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFicha(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inspecao.getFicha(tenantId, id);
  }

  @Patch('fichas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  patchFicha(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFichaDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.patchFicha(tenantId, id, user.id, dto, ip);
  }

  @Delete('fichas/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFicha(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.inspecao.deleteFicha(tenantId, id);
  }

  // ─── Grade ──────────────────────────────────────────────────────────────────

  @Get('fichas/:id/grade')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getGrade(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('pavimentoId', new ParseIntPipe({ optional: true })) pavimentoId?: number,
    @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
  ) {
    return this.inspecao.getGrade(tenantId, id, { pavimentoId, servicoId });
  }

  // ─── Registros ───────────────────────────────────────────────────────────────

  @Get('fichas/:fichaId/registros')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRegistros(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
    @Query('localId', new ParseIntPipe({ optional: true })) localId?: number,
  ) {
    if (servicoId === undefined || localId === undefined) {
      throw new BadRequestException('servicoId e localId são obrigatórios');
    }
    return this.inspecao.getRegistros(tenantId, fichaId, servicoId, localId);
  }

  @Put('fichas/:fichaId/registros')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  putRegistro(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Body() dto: PutRegistroDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.putRegistro(tenantId, fichaId, user.id, dto, ip);
  }

  // ─── Locais ──────────────────────────────────────────────────────────────────

  @Patch('fichas/:fichaId/locais/:localId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  patchLocal(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('localId', ParseIntPipe) localId: number,
    @Body() dto: UpdateLocalDto,
  ) {
    return this.inspecao.patchLocal(tenantId, fichaId, localId, {
      equipeResponsavel: dto.equipeResponsavel,
    });
  }

  // ─── Serviços da ficha ───────────────────────────────────────────────────────

  @Post('fichas/:id/servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  addServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
    @Body() dto: AddServicoDto,
  ) {
    return this.inspecao.addServico(tenantId, fichaId, dto);
  }

  @Delete('fichas/:fichaId/servicos/:servicoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeServico(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoId', ParseIntPipe) servicoId: number,
  ) {
    return this.inspecao.removeServico(tenantId, fichaId, servicoId);
  }

  // ─── Evidências ───────────────────────────────────────────────────────────────

  @Post('registros/:id/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('arquivo'))
  createEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) registroId: number,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    return this.inspecao.createEvidencia(tenantId, registroId, user.id, file, ip);
  }

  @Get('registros/:id/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getEvidencias(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) registroId: number,
  ) {
    return this.inspecao.getEvidencias(tenantId, registroId);
  }

  @Delete('evidencias/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.inspecao.deleteEvidencia(tenantId, id, user.id, ip);
  }

  // ─── Parecer ─────────────────────────────────────────────────────────────────

  @Post('fichas/:id/solicitar-parecer')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  solicitarParecer(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.parecer.solicitarParecer(tenantId, id, user.id, ip);
  }

  @Post('fichas/:id/parecer')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  submitParecer(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitParecerDto,
    @Ip() ip: string,
  ) {
    return this.parecer.submitParecer(tenantId, id, user.id, dto, ip);
  }

  @Post('fichas/:fichaId/registros/bulk')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  bulkInspecaoLocais(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Body() dto: BulkInspecaoDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.bulkInspecaoLocais(tenantId, fichaId, user.id, dto, ip);
  }

  // ─── NCs ─────────────────────────────────────────────────────────────────────

  @Get('fichas/:id/ncs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getNcs(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
    @Query('status') status?: string,
    @Query('criticidade') criticidade?: string,
    @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
    @Query('slaStatus') slaStatus?: string,
  ) {
    return this.inspecao.getNcs(tenantId, fichaId, { status, criticidade, servicoId, slaStatus });
  }

  @Post('fichas/:fichaId/ncs/:ncId/tratamento')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  registrarTratamento(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('ncId', ParseIntPipe) ncId: number,
    @Body() dto: RegistrarTratamentoDto,
  ) {
    return this.inspecao.registrarTratamento(tenantId, fichaId, ncId, user.id, {
      descricao: dto.descricao,
      acaoCorretiva: dto.acaoCorretiva,
      responsavelId: dto.responsavelId,
      prazo: dto.prazo,
      evidencias: dto.evidencias?.map(e => ({ gedVersaoId: e.gedVersaoId, descricao: e.descricao })),
    });
  }

  // ─── Grade Preview ───────────────────────────────────────────────────────────

  @Get('fichas/:fichaId/locais/:localId/servico/:servicoId/preview')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getGradePreview(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('localId', ParseIntPipe) localId: number,
    @Param('servicoId', ParseIntPipe) servicoId: number,
  ) {
    return this.inspecao.getGradePreview(tenantId, fichaId, localId, servicoId);
  }

  // ─── PDF da ficha ────────────────────────────────────────────────────────────

  @Get('fichas/:id/pdf')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getPdf(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
    @Query('apenasNc') apenasNc?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.fvsPdf.gerarPdf(fichaId, tenantId, { apenasNc: apenasNc === 'true' });
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="FVS-${fichaId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res!.end(buffer);
  }

  // ─── Timeline da ficha ───────────────────────────────────────────────────────

  @Get('fichas/:id/timeline')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async getTimeline(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT t.*, u.nome AS usuario_nome
       FROM fvs_timeline t
       LEFT JOIN "Usuario" u ON u.id = t.usuario_id
       WHERE t.ficha_id = $1 AND t.tenant_id = $2
       ORDER BY t.criado_em DESC
       LIMIT $3`,
      fichaId, tenantId, limit ?? 50,
    );
  }

  // ─── Compartilhamento com cliente ────────────────────────────────────────────

  @Post('fichas/:id/gerar-token-cliente')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async gerarTokenCliente(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
    @Body() body: { dias_validade?: number },
  ) {
    const token = crypto.randomBytes(32).toString('hex');
    const diasValidade = body.dias_validade ?? 30;
    const expira = new Date(Date.now() + diasValidade * 24 * 3600 * 1000);

    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_fichas
       SET token_cliente = $1, token_cliente_expires_at = $2
       WHERE id = $3 AND tenant_id = $4`,
      token, expira, fichaId, tenantId,
    );

    return { token, expira_em: expira.toISOString() };
  }

  @Delete('fichas/:id/token-cliente')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revogarTokenCliente(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
  ) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_fichas
       SET token_cliente = NULL, token_cliente_expires_at = NULL
       WHERE id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );
  }

  // ─── Markup de anotações em evidência ────────────────────────────────────────

  @Post('evidencias/:id/markup')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async salvarMarkup(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) evidenciaId: number,
    @Body() body: { tipo: string; dados_json: object },
  ) {
    const TIPOS_VALIDOS = ['seta', 'circulo', 'texto', 'retangulo'];
    if (!TIPOS_VALIDOS.includes(body.tipo)) {
      throw new BadRequestException(`Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}`);
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO fvs_markup_anotacoes (tenant_id, evidencia_id, tipo, dados_json, criado_por)
       VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *`,
      tenantId, evidenciaId, body.tipo, JSON.stringify(body.dados_json), user.id,
    );
    return rows[0];
  }

  @Get('evidencias/:id/markup')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getMarkup(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) evidenciaId: number,
  ) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM fvs_markup_anotacoes WHERE evidencia_id = $1 AND tenant_id = $2 ORDER BY criado_em ASC`,
      evidenciaId, tenantId,
    );
  }

  @Delete('markup/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMarkup(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvs_markup_anotacoes WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
  }

  // ─── IA: Diagnóstico de NC ───────────────────────────────────────────────────

  @Post('fichas/:fichaId/ncs/:ncId/diagnostico-ia')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async diagnosticarNc(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('ncId', ParseIntPipe) ncId: number,
  ) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT nc.*, cs.nome AS servico_nome, ci.descricao AS item_nome,
              o.nome AS obra_nome
       FROM fvs_nao_conformidades nc
       JOIN fvs_registros r ON r.id = nc.registro_id
       JOIN fvs_ficha_servicos fs ON fs.id = r.ficha_servico_id
       JOIN catalogo_servicos cs ON cs.id = fs.catalogo_servico_id
       LEFT JOIN catalogo_itens ci ON ci.id = r.catalogo_item_id
       JOIN fvs_fichas f ON f.id = r.ficha_id
       JOIN "Obra" o ON o.id = f.obra_id
       WHERE nc.id = $1 AND f.id = $2 AND nc.tenant_id = $3`,
      ncId, fichaId, tenantId,
    );
    if (!rows.length) throw new BadRequestException('NC não encontrada');
    const nc = rows[0];

    return this.diagnosticoNc.executar({
      tenant_id: tenantId,
      usuario_id: user.id,
      ficha_id: fichaId,
      nc_id: ncId,
      servico_nome: nc.servico_nome,
      item_nome: nc.item_nome ?? '',
      criticidade: nc.criticidade,
      descricao: nc.descricao,
      obra_nome: nc.obra_nome,
    });
  }

  // ─── IA: Score de risco da ficha ─────────────────────────────────────────────

  @Post('fichas/:id/calcular-risco')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  async calcularRisco(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) fichaId: number,
  ) {
    const fichas = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT obra_id FROM fvs_fichas WHERE id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );
    if (!fichas.length) throw new BadRequestException('Ficha não encontrada');

    return this.preditorNc.executar({
      tenant_id: tenantId,
      usuario_id: user.id,
      ficha_id: fichaId,
      obra_id: fichas[0].obra_id,
    });
  }

  // ─── IA: Análise de foto por visão ──────────────────────────────────────────

  @Post('evidencias/:id/analisar-foto')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async analisarFoto(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) evidenciaId: number,
    @Body() body: { image_base64: string; mime_type?: string },
  ) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT e.*, ci.descricao AS item_nome, cs.nome AS servico_nome
       FROM fvs_evidencias e
       JOIN fvs_registros r ON r.id = e.registro_id
       JOIN fvs_ficha_servicos fs ON fs.id = r.ficha_servico_id
       JOIN catalogo_servicos cs ON cs.id = fs.catalogo_servico_id
       LEFT JOIN catalogo_itens ci ON ci.id = r.catalogo_item_id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      evidenciaId, tenantId,
    );
    if (!rows.length) throw new BadRequestException('Evidência não encontrada');
    const ev = rows[0];

    return this.analiseFoto.executar({
      tenant_id: tenantId,
      usuario_id: user.id,
      registro_id: ev.registro_id,
      item_nome: ev.item_nome ?? '',
      servico_nome: ev.servico_nome,
      image_base64: body.image_base64,
      mime_type: body.mime_type,
    });
  }
}
