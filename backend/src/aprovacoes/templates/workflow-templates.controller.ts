import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { CreateWorkflowTemplateDto } from './dto/create-workflow-template.dto';
import { AprovacaoModulo } from '@prisma/client';

@Controller('api/v1/aprovacoes/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowTemplatesController {
  constructor(private readonly service: WorkflowTemplatesService) {}

  // ── POST /api/v1/aprovacoes/templates ─────────────────────────────────────

  @Post()
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @Body() dto: CreateWorkflowTemplateDto,
  ) {
    return this.service.criar(tenantId, dto);
  }

  // ── GET /api/v1/aprovacoes/templates ──────────────────────────────────────

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  listar(
    @TenantId() tenantId: number,
    @Query('modulo') modulo?: AprovacaoModulo,
    @Query('ativo') ativoStr?: string,
  ) {
    const ativo =
      ativoStr === 'true' ? true : ativoStr === 'false' ? false : undefined;
    return this.service.listar(tenantId, modulo, ativo);
  }

  // ── GET /api/v1/aprovacoes/templates/:id ──────────────────────────────────

  @Get(':id')
  @Roles('ADMIN_TENANT')
  buscar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.buscar(tenantId, id);
  }

  // ── PUT /api/v1/aprovacoes/templates/:id ──────────────────────────────────

  @Put(':id')
  @Roles('ADMIN_TENANT')
  atualizar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateWorkflowTemplateDto,
  ) {
    return this.service.atualizar(tenantId, id, dto);
  }

  // ── PATCH /api/v1/aprovacoes/templates/:id/desativar ──────────────────────

  @Patch(':id/desativar')
  @Roles('ADMIN_TENANT')
  desativar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.desativar(tenantId, id);
  }
}
