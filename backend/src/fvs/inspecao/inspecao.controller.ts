// backend/src/fvs/inspecao/inspecao.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Put, Body, Param, Query,
  ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, Ip, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { InspecaoService } from './inspecao.service';
import { ParecerService } from './parecer.service';
import { CreateFichaDto } from './dto/create-ficha.dto';
import { UpdateFichaDto } from './dto/update-ficha.dto';
import { PutRegistroDto } from './dto/put-registro.dto';
import { UpdateLocalDto } from './dto/update-local.dto';
import { AddServicoDto } from './dto/add-servico.dto';
import { SubmitParecerDto } from './dto/submit-parecer.dto';
import { BulkInspecaoDto } from './dto/bulk-inspecao.dto';
import { RegistrarTratamentoDto } from './dto/registrar-tratamento.dto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/fvs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InspecaoController {
  constructor(
    private readonly inspecao: InspecaoService,
    private readonly parecer: ParecerService,
  ) {}

  // ─── Fichas ─────────────────────────────────────────────────────────────────

  @Post('fichas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createFicha(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFichaDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.createFicha(tenantId, user.id, dto, ip);
  }

  @Get('fichas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFichas(
    @TenantId() tenantId: number,
    @Query('obraId', new ParseIntPipe({ optional: true })) obraId?: number,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.inspecao.getFichas(tenantId, obraId, page, limit);
  }

  @Get('fichas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFicha(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inspecao.getFicha(tenantId, id);
  }

  @Patch('fichas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  patchFicha(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFichaDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.patchFicha(tenantId, id, user.id, dto, ip);
  }

  @Delete('fichas/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFicha(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.inspecao.deleteFicha(tenantId, id);
  }

  // ─── Grade ──────────────────────────────────────────────────────────────────

  @Get('fichas/:id/grade')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getGrade(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('pavimentoId', new ParseIntPipe({ optional: true })) pavimentoId?: number,
    @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
  ) {
    return this.inspecao.getGrade(tenantId, id, { pavimentoId, servicoId });
  }

  // ─── Registros ───────────────────────────────────────────────────────────────

  @Get('fichas/:fichaId/registros')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRegistros(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
    @Query('localId', new ParseIntPipe({ optional: true })) localId?: number,
  ) {
    if (servicoId === undefined || localId === undefined) {
      throw new BadRequestException('servicoId e localId são obrigatórios');
    }
    return this.inspecao.getRegistros(tenantId, fichaId, servicoId, localId);
  }

  @Put('fichas/:fichaId/registros')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  putRegistro(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Body() dto: PutRegistroDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.putRegistro(tenantId, fichaId, user.id, dto, ip);
  }

  // ─── Locais ──────────────────────────────────────────────────────────────────

  @Patch('fichas/:fichaId/locais/:localId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  patchLocal(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('localId', ParseIntPipe) localId: number,
    @Body() dto: UpdateLocalDto,
  ) {
    return this.inspecao.patchLocal(tenantId, fichaId, localId, {
      equipeResponsavel: dto.equipeResponsavel,
    });
  }

  // ─── Serviços da ficha ───────────────────────────────────────────────────────

  @Post('fichas/:id/servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  addServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
    @Body() dto: AddServicoDto,
  ) {
    return this.inspecao.addServico(tenantId, fichaId, dto);
  }

  @Delete('fichas/:fichaId/servicos/:servicoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeServico(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoId', ParseIntPipe) servicoId: number,
  ) {
    return this.inspecao.removeServico(tenantId, fichaId, servicoId);
  }

  // ─── Evidências ───────────────────────────────────────────────────────────────

  @Post('registros/:id/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('arquivo'))
  createEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) registroId: number,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    return this.inspecao.createEvidencia(tenantId, registroId, user.id, file, ip);
  }

  @Get('registros/:id/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getEvidencias(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) registroId: number,
  ) {
    return this.inspecao.getEvidencias(tenantId, registroId);
  }

  @Delete('evidencias/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.inspecao.deleteEvidencia(tenantId, id, user.id, ip);
  }

  // ─── Parecer ─────────────────────────────────────────────────────────────────

  @Post('fichas/:id/solicitar-parecer')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  solicitarParecer(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.parecer.solicitarParecer(tenantId, id, user.id, ip);
  }

  @Post('fichas/:id/parecer')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  submitParecer(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitParecerDto,
    @Ip() ip: string,
  ) {
    return this.parecer.submitParecer(tenantId, id, user.id, dto, ip);
  }

  @Post('fichas/:fichaId/registros/bulk')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  bulkInspecaoLocais(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Body() dto: BulkInspecaoDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.bulkInspecaoLocais(tenantId, fichaId, user.id, dto, ip);
  }

  // ─── NCs ─────────────────────────────────────────────────────────────────────

  @Get('fichas/:id/ncs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getNcs(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
    @Query('status') status?: string,
    @Query('criticidade') criticidade?: string,
    @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
    @Query('slaStatus') slaStatus?: string,
  ) {
    return this.inspecao.getNcs(tenantId, fichaId, { status, criticidade, servicoId, slaStatus });
  }

  @Post('fichas/:fichaId/ncs/:ncId/tratamento')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  registrarTratamento(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('ncId', ParseIntPipe) ncId: number,
    @Body() dto: RegistrarTratamentoDto,
  ) {
    return this.inspecao.registrarTratamento(tenantId, fichaId, ncId, user.id, {
      descricao: dto.descricao,
      acaoCorretiva: dto.acaoCorretiva,
      responsavelId: dto.responsavelId,
      prazo: dto.prazo,
      evidencias: dto.evidencias?.map(e => ({ gedVersaoId: e.gedVersaoId, descricao: e.descricao })),
    });
  }
}
