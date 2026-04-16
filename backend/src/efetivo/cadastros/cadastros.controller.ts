import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CadastrosService } from './cadastros.service';
import { CreateEmpresaDto } from '../dto/create-empresa.dto';
import { CreateFuncaoDto } from '../dto/create-funcao.dto';

@Controller('api/v1/efetivo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CadastrosController {
  constructor(private readonly service: CadastrosService) {}

  // GET /api/v1/efetivo/empresas
  @Get('empresas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getEmpresas(@TenantId() tenantId: number) {
    return this.service.getEmpresas(tenantId);
  }

  // POST /api/v1/efetivo/empresas
  @Post('empresas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createEmpresa(
    @TenantId() tenantId: number,
    @Body() dto: CreateEmpresaDto,
  ) {
    return this.service.createEmpresa(tenantId, dto);
  }

  // PATCH /api/v1/efetivo/empresas/:id
  @Patch('empresas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateEmpresa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ nome: string; cnpj: string; ativa: boolean }>,
  ) {
    return this.service.updateEmpresa(tenantId, id, body);
  }

  // GET /api/v1/efetivo/funcoes
  @Get('funcoes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFuncoes(@TenantId() tenantId: number) {
    return this.service.getFuncoes(tenantId);
  }

  // POST /api/v1/efetivo/funcoes
  @Post('funcoes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createFuncao(
    @TenantId() tenantId: number,
    @Body() dto: CreateFuncaoDto,
  ) {
    return this.service.createFuncao(tenantId, dto);
  }

  // PATCH /api/v1/efetivo/funcoes/:id
  @Patch('funcoes/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateFuncao(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ nome: string; ativa: boolean }>,
  ) {
    return this.service.updateFuncao(tenantId, id, body);
  }

  // DELETE /api/v1/efetivo/empresas/:id
  @Delete('empresas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  deleteEmpresa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteEmpresa(tenantId, id);
  }

  // DELETE /api/v1/efetivo/funcoes/:id
  @Delete('funcoes/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.OK)
  deleteFuncao(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteFuncao(tenantId, id);
  }
}
