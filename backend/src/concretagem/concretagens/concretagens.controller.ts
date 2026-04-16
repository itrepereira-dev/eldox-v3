// backend/src/concretagem/concretagens/concretagens.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { ConcrtagensService } from './concretagens.service';
import { CreateConcrtagemDto } from './dto/create-concretagem.dto';
import { UpdateConcrtagemDto } from './dto/update-concretagem.dto';
import { ListConcrtagensDto } from './dto/list-concretagens.dto';
import { CancelConcrtagemDto } from './dto/cancel-concretagem.dto';

@Controller('api/v1/obras/:obraId/concretagem/concretagens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConcrtagensController {
  constructor(private readonly svc: ConcrtagensService) {}

  // POST /api/v1/obras/:obraId/concretagem/concretagens
  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async criar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateConcrtagemDto,
  ) {
    const data = await this.svc.criar(tenantId, obraId, user.id, dto);
    return { status: 'success', data };
  }

  // GET /api/v1/obras/:obraId/concretagem/concretagens
  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async listar(
    @Param('obraId', ParseIntPipe) obraId: number,
    @TenantId() tenantId: number,
    @Query() query: ListConcrtagensDto,
  ) {
    const data = await this.svc.listar(tenantId, obraId, query);
    return { status: 'success', data };
  }

  // GET /api/v1/obras/:obraId/concretagem/concretagens/:id
  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  async buscar(
    @Param('obraId', ParseIntPipe) _obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.svc.buscar(tenantId, id);
    return { status: 'success', data };
  }

  // PATCH /api/v1/obras/:obraId/concretagem/concretagens/:id
  @Patch(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  async atualizar(
    @Param('obraId', ParseIntPipe) _obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateConcrtagemDto,
  ) {
    const data = await this.svc.atualizar(tenantId, id, user.id, dto);
    return { status: 'success', data };
  }

  // DELETE /api/v1/obras/:obraId/concretagem/concretagens/:id
  @Delete(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  async cancelar(
    @Param('obraId', ParseIntPipe) _obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CancelConcrtagemDto,
  ) {
    const data = await this.svc.cancelar(tenantId, id, user.id, dto);
    return { status: 'success', data };
  }

  // POST /api/v1/obras/:obraId/concretagem/concretagens/:id/toggle-liberado
  @Post(':id/toggle-liberado')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async toggleLiberado(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
  ) {
    const data = await this.svc.toggleLiberado(tenantId, id, user.id);
    return { status: 'success', data };
  }
}
