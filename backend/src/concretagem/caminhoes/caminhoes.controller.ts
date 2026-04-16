// backend/src/concretagem/caminhoes/caminhoes.controller.ts
import {
  Controller,
  Post,
  Patch,
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
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { CaminhoesService } from './caminhoes.service';
import { OcrNfService } from './ocr-nf.service';
import { CreateCaminhaoDto } from './dto/create-caminhao.dto';
import { RegistrarSlumpDto, RejeitarCaminhaoDto } from './dto/registrar-slump.dto';
import { PatchCaminhaoDto } from './dto/patch-caminhao.dto';
import { OcrNfDto } from './dto/ocr-nf.dto';

@Controller('api/v1/concretagem')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CaminhoesController {
  constructor(
    private readonly svc: CaminhoesService,
    private readonly ocrSvc: OcrNfService,
  ) {}

  // POST /api/v1/concretagem/concretagens/:concretagemId/caminhoes
  @Post('concretagens/:concretagemId/caminhoes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  async registrarChegada(
    @Param('concretagemId', ParseIntPipe) concrtagemId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateCaminhaoDto,
  ) {
    const data = await this.svc.registrarChegada(tenantId, concrtagemId, user.id, dto);
    return { status: 'success', data };
  }

  // PATCH /api/v1/concretagem/caminhoes/:id/slump
  @Patch('caminhoes/:id/slump')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async registrarSlump(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: RegistrarSlumpDto,
  ) {
    const data = await this.svc.registrarSlump(tenantId, id, user.id, dto);
    return { status: 'success', data };
  }

  // PATCH /api/v1/concretagem/caminhoes/:id/concluir
  @Patch('caminhoes/:id/concluir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async concluirLancamento(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
  ) {
    const data = await this.svc.concluirLancamento(tenantId, id, user.id);
    return { status: 'success', data };
  }

  // PATCH /api/v1/concretagem/caminhoes/:id/rejeitar
  @Patch('caminhoes/:id/rejeitar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  async rejeitar(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: RejeitarCaminhaoDto,
  ) {
    const data = await this.svc.rejeitar(tenantId, id, user.id, dto.motivo);
    return { status: 'success', data };
  }

  // PATCH /api/v1/concretagem/caminhoes/:id
  @Patch('caminhoes/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  async patchCaminhao(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: PatchCaminhaoDto,
  ) {
    const data = await this.svc.patchCaminhao(tenantId, id, user.id, dto);
    return { status: 'success', data };
  }

  // POST /api/v1/concretagem/caminhoes/:id/toggle-nao-descarregou
  @Post('caminhoes/:id/toggle-nao-descarregou')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async toggleNaoDescarregou(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() body: { responsabilidade_concreteira?: boolean },
  ) {
    const data = await this.svc.toggleNaoDescarregou(tenantId, id, user.id, body.responsabilidade_concreteira);
    return { status: 'success', data };
  }

  // POST /api/v1/concretagem/caminhoes/:id/lacre
  @Post('caminhoes/:id/lacre')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async setLacre(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() body: { aprovado: boolean },
  ) {
    const data = await this.svc.setLacre(tenantId, id, user.id, body.aprovado);
    return { status: 'success', data };
  }

  // POST /api/v1/concretagem/caminhoes/ocr-nf
  @Post('caminhoes/ocr-nf')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  async ocrNf(
    @TenantId() tenantId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: OcrNfDto,
  ) {
    const data = await this.ocrSvc.extrairDadosNf(tenantId, user.id, dto.image_base64, dto.media_type);
    return { status: 'success', data };
  }
}
