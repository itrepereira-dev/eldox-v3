import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PerfisAcessoService } from './perfis-acesso.service';
import { CriarPerfilDto } from './dto/criar-perfil.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { SalvarPermissoesDto } from './dto/salvar-permissoes.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('api/v1/perfis-acesso')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_TENANT' as never)
export class PerfisAcessoController {
  constructor(private readonly perfis: PerfisAcessoService) {}

  @Get()
  listar(@TenantId() tenantId: number) {
    return this.perfis.listar(tenantId);
  }

  @Get(':id')
  detalhar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.perfis.detalhar(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(@TenantId() tenantId: number, @Body() dto: CriarPerfilDto) {
    return this.perfis.criar(tenantId, dto);
  }

  @Patch(':id')
  atualizar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarPerfilDto,
  ) {
    return this.perfis.atualizar(tenantId, id, dto);
  }

  @Put(':id/permissoes')
  salvarPermissoes(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarPermissoesDto,
  ) {
    return this.perfis.salvarPermissoes(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  desativar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.perfis.desativar(tenantId, id);
  }
}
