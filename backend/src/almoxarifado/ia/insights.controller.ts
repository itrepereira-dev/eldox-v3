// backend/src/almoxarifado/ia/insights.controller.ts
import {
  Controller, Get, Post, Patch, Param, Req,
  UseGuards, HttpCode, HttpStatus, ParseIntPipe,
} from '@nestjs/common';
import { InjectQueue }   from '@nestjs/bull';
import type { Queue }    from 'bull';
import { JwtAuthGuard }  from '../../common/guards/jwt.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { TenantId }      from '../../common/decorators/tenant.decorator';
import { InsightsService } from './insights.service';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InsightsController {
  constructor(
    private readonly insights: InsightsService,
    @InjectQueue('almoxarifado') private readonly queue: Queue,
  ) {}

  @Get('insights')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(@TenantId() tenantId: number) {
    return this.insights.listar(tenantId);
  }

  @Post('insights/reanalisar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.ACCEPTED)
  async reanalisar(@TenantId() tenantId: number) {
    await this.queue.add('gerar-insights', { tenantId }, { priority: 1 });
    return { enqueued: true };
  }

  @Patch('insights/:id/aplicar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  aplicar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.insights.aplicar(tenantId, id, usuarioId);
  }

  @Patch('insights/:id/ignorar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  ignorar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.insights.ignorar(tenantId, id);
  }
}
