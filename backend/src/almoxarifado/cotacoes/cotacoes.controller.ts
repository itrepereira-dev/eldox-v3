// backend/src/almoxarifado/cotacoes/cotacoes.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { CotacoesService } from './cotacoes.service';

@Controller('api/v1/almoxarifado')
export class CotacoesController {
  constructor(private readonly cotacoes: CotacoesService) {}

  // ── Criar cotação para um fornecedor ──────────────────────────────────────────
  // POST /api/v1/almoxarifado/solicitacoes/:solId/cotacoes

  @Post('solicitacoes/:solId/cotacoes')
  async criar(
    @Req() req: any,
    @Param('solId', ParseIntPipe) solId: number,
    @Body() body: { fornecedor_id: number; validade_dias?: number; observacao?: string },
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const data = await this.cotacoes.criar(tenantId, solId, body.fornecedor_id, body);
    return { status: 'success', data };
  }

  // ── Listar cotações de uma solicitação ────────────────────────────────────────
  // GET /api/v1/almoxarifado/solicitacoes/:solId/cotacoes

  @Get('solicitacoes/:solId/cotacoes')
  async listar(
    @Req() req: any,
    @Param('solId', ParseIntPipe) solId: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const data = await this.cotacoes.listar(tenantId, solId);
    return { status: 'success', data };
  }

  // ── Comparativo de preços (tabela lado a lado) ─────────────────────────────────
  // GET /api/v1/almoxarifado/solicitacoes/:solId/cotacoes/comparativo

  @Get('solicitacoes/:solId/cotacoes/comparativo')
  async comparativo(
    @Req() req: any,
    @Param('solId', ParseIntPipe) solId: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const data = await this.cotacoes.getComparativo(tenantId, solId);
    return { status: 'success', data };
  }

  // ── Curva ABC ─────────────────────────────────────────────────────────────────
  // GET /api/v1/almoxarifado/solicitacoes/:solId/cotacoes/curva-abc

  @Get('solicitacoes/:solId/cotacoes/curva-abc')
  async curvaAbc(
    @Req() req: any,
    @Param('solId', ParseIntPipe) solId: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const data = await this.cotacoes.getCurvaAbc(tenantId, solId);
    return { status: 'success', data };
  }

  // ── Gerar OC(s) a partir das cotações ─────────────────────────────────────────
  // POST /api/v1/almoxarifado/solicitacoes/:solId/cotacoes/gerar-oc

  @Post('solicitacoes/:solId/cotacoes/gerar-oc')
  async gerarOc(
    @Req() req: any,
    @Param('solId', ParseIntPipe) solId: number,
    @Body() body: {
      modo: 'automatico' | 'manual';
      selecoes?: { catalogo_id: number; cotacao_id: number }[];
      local_entrega?: string;
      condicao_pgto_override?: string;
    },
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const userId: number   = req.user?.sub ?? req.user?.id;
    const data = await this.cotacoes.gerarOcs(tenantId, solId, userId, body);
    return { status: 'success', data };
  }

  // ── Detalhe de uma cotação ────────────────────────────────────────────────────
  // GET /api/v1/almoxarifado/cotacoes/:id

  @Get('cotacoes/:id')
  async buscar(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const data = await this.cotacoes.buscar(tenantId, id);
    return { status: 'success', data };
  }

  // ── Enviar ao fornecedor (gera token + link) ──────────────────────────────────
  // PATCH /api/v1/almoxarifado/cotacoes/:id/enviar

  @Patch('cotacoes/:id/enviar')
  async enviar(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    const data = await this.cotacoes.enviar(tenantId, id);
    return { status: 'success', data };
  }

  // ── Cancelar ─────────────────────────────────────────────────────────────────
  // DELETE /api/v1/almoxarifado/cotacoes/:id

  @Delete('cotacoes/:id')
  @HttpCode(200)
  async cancelar(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const tenantId: number = req.user?.tenantId ?? req.user?.tenant_id;
    await this.cotacoes.cancelar(tenantId, id);
    return { status: 'success', message: 'Cotação cancelada' };
  }
}
