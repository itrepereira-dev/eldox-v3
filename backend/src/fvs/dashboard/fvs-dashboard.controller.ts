// backend/src/fvs/dashboard/fvs-dashboard.controller.ts
import {
  Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { FvsDashboardService } from './fvs-dashboard.service';
import { AgentePriorizacaoInspecao } from '../../ai/agents/fvs/agente-priorizacao-inspecao';
import { AgenteRelatorioFvs } from '../../ai/agents/fvs/agente-relatorio-fvs';
import { FvsGraficosService } from './fvs-graficos.service';
import { DashboardGraficosQueryDto } from './dto/dashboard-graficos-query.dto';
import { RelatorioService } from './relatorio.service';
import { RelatorioConformidadeQueryDto } from './relatorio-conformidade.dto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/fvs/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FvsDashboardController {
  constructor(
    private readonly dashboard: FvsDashboardService,
    private readonly priorizacao: AgentePriorizacaoInspecao,
    private readonly relatorio: AgenteRelatorioFvs,
    private readonly graficos: FvsGraficosService,
    private readonly relatorioService: RelatorioService,
  ) {}

  // GET /api/v1/fvs/dashboard/global
  @Get('global')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getGlobal(@TenantId() tenantId: number) {
    return this.dashboard.getResumoGlobal(tenantId);
  }

  // GET /api/v1/fvs/dashboard/obras/:obraId
  @Get('obras/:obraId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getResumoObra(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.dashboard.getResumoObra(tenantId, obraId);
  }

  // GET /api/v1/fvs/dashboard/obras/:obraId/por-servico
  @Get('obras/:obraId/por-servico')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getTaxaPorServico(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.dashboard.getTaxaPorServico(tenantId, obraId);
  }

  // GET /api/v1/fvs/dashboard/obras/:obraId/evolucao?dias=30
  @Get('obras/:obraId/evolucao')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getEvolucao(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('dias', new ParseIntPipe({ optional: true })) dias?: number,
  ) {
    return this.dashboard.getEvolucaoTemporal(tenantId, obraId, dias ?? 30);
  }

  // GET /api/v1/fvs/dashboard/obras/:obraId/top-ncs?limit=10
  @Get('obras/:obraId/top-ncs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getTopNcs(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.dashboard.getTopNcs(tenantId, obraId, limit ?? 10);
  }

  // POST /api/v1/fvs/dashboard/obras/:obraId/priorizacao
  @Post('obras/:obraId/priorizacao')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  getPriorizacao(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.priorizacao.executar({ tenant_id: tenantId, usuario_id: user.id, obra_id: obraId });
  }

  // POST /api/v1/fvs/dashboard/obras/:obraId/relatorio-semanal
  @Post('obras/:obraId/relatorio-semanal')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  getRelatorioSemanal(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Body() body: { obra_nome: string; semana_inicio: string; semana_fim: string },
  ) {
    return this.relatorio.executar({
      tenant_id: tenantId,
      usuario_id: user.id,
      obra_id: obraId,
      obra_nome: body.obra_nome,
      semana_inicio: body.semana_inicio,
      semana_fim: body.semana_fim,
    });
  }

  // GET /api/v1/fvs/dashboard/obras/:obraId/dashboard-graficos
  @Get('obras/:obraId/dashboard-graficos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getDashboardGraficos(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query() query: DashboardGraficosQueryDto,
  ) {
    return this.graficos.getDashboardGraficos(tenantId, obraId, query);
  }

  // GET /api/v1/fvs/dashboard/obras/:obraId/relatorio-conformidade
  @Get('obras/:obraId/relatorio-conformidade')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRelatorioConformidade(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query() query: RelatorioConformidadeQueryDto,
  ) {
    const servicoId = query.servico_id ? parseInt(query.servico_id, 10) : null;
    const dataInicio = query.data_inicio ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dataFim = query.data_fim ?? new Date().toISOString();
    return this.relatorioService.getConformidade(tenantId, obraId, servicoId, dataInicio, dataFim);
  }
}
