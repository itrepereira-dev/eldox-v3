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
  UseGuards,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { DefinirAtivoDto } from './dto/definir-ativo.dto';
import { AtribuirPerfilDto } from './dto/atribuir-perfil.dto';
import { SalvarOverridesDto } from './dto/salvar-overrides.dto';
import { VincularObraDto } from './dto/vincular-obra.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../common/decorators/tenant.decorator';

@Controller('api/v1/usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_TENANT' as never)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar(@TenantId() tenantId: number) {
    return this.usuarios.listar(tenantId);
  }

  @Get(':id')
  detalhar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuarios.detalhar(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @CurrentUser() user: { role: string },
    @Body() dto: CriarUsuarioDto,
  ) {
    return this.usuarios.criarComConvite(tenantId, user.role, dto);
  }

  @Patch(':id')
  atualizar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarUsuarioDto,
  ) {
    return this.usuarios.atualizar(tenantId, id, dto);
  }

  @Patch(':id/ativo')
  definirAtivo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirAtivoDto,
  ) {
    return this.usuarios.definirAtivo(tenantId, id, dto.ativo);
  }

  @Patch(':id/perfil')
  atribuirPerfil(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtribuirPerfilDto,
  ) {
    return this.usuarios.atribuirPerfil(tenantId, id, dto);
  }

  @Post(':id/reenviar-convite')
  @HttpCode(HttpStatus.OK)
  reenviarConvite(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuarios.reenviarConvite(tenantId, id);
  }

  @Post(':id/reset-senha')
  @HttpCode(HttpStatus.OK)
  resetSenha(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuarios.gerarResetSenha(tenantId, id);
  }

  // ─────────────────────────── Obras liberadas

  @Get(':id/obras')
  listarObras(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuarios.listarObras(tenantId, id);
  }

  @Post(':id/obras')
  @HttpCode(HttpStatus.CREATED)
  vincularObra(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VincularObraDto,
  ) {
    return this.usuarios.vincularObra(tenantId, id, dto.obraId);
  }

  @Delete(':id/obras/:obraId')
  desvincularObra(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('obraId', ParseIntPipe) obraId: number,
  ) {
    return this.usuarios.desvincularObra(tenantId, id, obraId);
  }

  // ─────────────────────────── Overrides de permissão

  @Get(':id/permissoes')
  listarOverrides(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuarios.listarOverrides(tenantId, id);
  }

  @Patch(':id/permissoes')
  salvarOverrides(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
    @Body() dto: SalvarOverridesDto,
  ) {
    return this.usuarios.salvarOverrides(tenantId, id, user.id, dto);
  }

  @Delete(':id/permissoes/:modulo')
  removerOverride(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('modulo') modulo: string,
  ) {
    return this.usuarios.removerOverride(tenantId, id, modulo);
  }
}
