// backend/src/almoxarifado/ia/variantes.controller.ts
// Endpoints para gestão de variantes do catálogo e sugestões de IA

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  Req,
  HttpCode,
} from '@nestjs/common';
import { AgenteCatalogoService } from './agente-catalogo.service';
import { PrismaService } from '../../prisma/prisma.service';
@Controller('api/v1/almoxarifado/catalogo')
export class VariantesController {
  constructor(
    private readonly agente: AgenteCatalogoService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('identificar')
  async identificar(
    @Req() req: any,
    @Body() body: { descricao: string; unidade?: string },
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const result = await this.agente.identificarProduto(tenantId, body.descricao, body.unidade ?? null, null);
    return { status: 'success', data: result };
  }

  @Get('sugestoes')
  async listarSugestoes(
    @Req() req: any,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const data = await this.agente.listarSugestoesPendentes(tenantId, limit, offset);
    return { status: 'success', data };
  }

  @Patch('sugestoes/:id/aprovar')
  async aprovarSugestao(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { catalogo_id?: number; fator_conversao?: number; marca?: string },
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const userId: number   = req.user?.sub ?? req.user?.id;
    const varianteId = await this.agente.confirmarSugestao(id, tenantId, userId, body);
    return { status: 'success', data: { variante_id: varianteId } };
  }

  @Patch('sugestoes/:id/rejeitar')
  @HttpCode(200)
  async rejeitarSugestao(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const userId: number   = req.user?.sub ?? req.user?.id;
    await this.agente.rejeitarSugestao(id, tenantId, userId);
    return { status: 'success', message: 'Sugestão rejeitada' };
  }

  @Get('variantes/:catalogoId')
  async listarVariantes(
    @Req() req: any,
    @Param('catalogoId', ParseIntPipe) catalogoId: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const data = await this.prisma.$queryRawUnsafe(
      `SELECT v.*, u.nome AS confirmado_por_nome
       FROM alm_catalogo_variantes v
       LEFT JOIN "Usuario" u ON u.id = v.confirmado_por
       WHERE v.tenant_id = $1 AND v.catalogo_id = $2 AND v.ativo = true
       ORDER BY v.created_at DESC`,
      tenantId, catalogoId,
    );
    return { status: 'success', data };
  }

  @Post('variantes')
  async criarVariante(
    @Req() req: any,
    @Body() body: {
      catalogo_id: number;
      descricao_orig: string;
      marca?: string;
      codigo_fornecedor?: string;
      unidade_orig?: string;
      fator_conversao?: number;
      sinapi_codigo?: string;
    },
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const userId: number   = req.user?.sub ?? req.user?.id;
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO alm_catalogo_variantes
         (tenant_id, catalogo_id, descricao_orig, marca, codigo_fornecedor,
          unidade_orig, fator_conversao, sinapi_codigo, origem, confirmado_por, confirmado_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual', $9, NOW())
       RETURNING id`,
      tenantId, body.catalogo_id, body.descricao_orig,
      body.marca ?? null, body.codigo_fornecedor ?? null,
      body.unidade_orig ?? null, body.fator_conversao ?? 1.0,
      body.sinapi_codigo ?? null, userId,
    );
    return { status: 'success', data: { id: rows[0]?.id } };
  }

  @Delete('variantes/:id')
  @HttpCode(200)
  async desativarVariante(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_catalogo_variantes SET ativo = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    return { status: 'success', message: 'Variante desativada' };
  }
}
