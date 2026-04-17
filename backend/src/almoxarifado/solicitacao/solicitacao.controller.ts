// backend/src/almoxarifado/solicitacao/solicitacao.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { SolicitacaoService } from './solicitacao.service';
import { CreateSolicitacaoDto } from './dto/create-solicitacao.dto';
import { AprovarSolicitacaoDto } from './dto/aprovar-solicitacao.dto';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitacaoController {
  constructor(private readonly solicitacao: SolicitacaoService) {}

  // ── Listar solicitações ───────────────────────────────────────────────────

  @Get('solicitacoes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @Query('local_destino_id') localDestinoId?: string,
    @Query('status') status?: string,
    @Query('limit')  limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.solicitacao.listar(tenantId, {
      localDestinoId: localDestinoId ? Number(localDestinoId) : undefined,
      status,
      limit:  limit  ? Number(limit)  : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // ── Criar ────────────────────────────────────────────────────────────────

  @Post('solicitacoes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @Body() dto: CreateSolicitacaoDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.solicitacao.criar(tenantId, usuarioId, dto);
  }

  // ── Detalhe ───────────────────────────────────────────────────────────────

  @Get('solicitacoes/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  buscar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.solicitacao.buscarOuFalhar(tenantId, id);
  }

  // ── Submeter ──────────────────────────────────────────────────────────────

  @Patch('solicitacoes/:id/submeter')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  submeter(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.solicitacao.submeter(tenantId, id);
  }

  // ── Aprovar / Reprovar ────────────────────────────────────────────────────

  @Post('solicitacoes/:id/aprovar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  aprovar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprovarSolicitacaoDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.solicitacao.aprovar(tenantId, id, usuarioId, dto);
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────

  @Patch('solicitacoes/:id/cancelar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.solicitacao.cancelar(tenantId, id, usuarioId);
  }
}
