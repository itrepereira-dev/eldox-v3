// backend/src/almoxarifado/nfe/nfe.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Req,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { NfeService } from './nfe.service';
import {
  AceitarNfeDto,
  RejeitarNfeDto,
  VincularOcDto,
  ConfirmarMatchDto,
} from './dto/aceitar-nfe.dto';

@Controller('api/v1/almoxarifado')
export class NfeController {
  constructor(
    private readonly nfe: NfeService,
    private readonly config: ConfigService,
  ) {}

  // ── Webhook (sem JWT — vem de serviço externo) ─────────────────────────────

  @Post('webhooks/nfe')
  @HttpCode(HttpStatus.ACCEPTED)
  async receberWebhook(
    @Headers('authorization') authHeader: string,
    @Body() payload: Record<string, unknown>,
  ) {
    // Validação mínima por Bearer token
    // TODO: Quando o Qive fornecer documentação, ajustar para o método de auth deles
    //       (ex: HMAC-SHA256 no header X-Qive-Signature, ou outro mecanismo)
    const secret = this.config.get<string>('WEBHOOK_NFE_SECRET');
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Webhook secret não configurado');
      }
      // dev/staging: permite, mas loga
    } else {
      const token = authHeader?.replace('Bearer ', '').trim();
      if (token !== secret) {
        throw new UnauthorizedException('Webhook secret inválido');
      }
    }

    return this.nfe.receberWebhook(payload);
  }

  // ── Upload manual de XML (autenticado) ────────────────────────────────────
  //
  // Aceita um arquivo XML de NF-e enviado pelo usuário (drag-and-drop na UI).
  // Reutiliza o pipeline do webhook — grava em alm_nfe_webhooks e enfileira
  // o job de processamento. Idempotente por chave_nfe.
  //
  // Limite de 2MB: uma NF-e típica tem 30-200KB. Raramente passa de 1MB.
  @Post('nfes/upload-xml')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype === 'application/xml' ||
          file.mimetype === 'text/xml' ||
          file.originalname?.toLowerCase().endsWith('.xml');
        cb(ok ? null : new BadRequestException('Arquivo precisa ser .xml'), ok);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadXml(
    @TenantId() tenantId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    const xmlContent = file.buffer.toString('utf8');
    return this.nfe.importarXml(tenantId, xmlContent);
  }

  // ── Diagnóstico da fila BullMQ (admin) ────────────────────────────────────
  //
  // Retorna ping do Redis, contagens por estado da queue 'almoxarifado' e os
  // últimos jobs failed/waiting. Útil para entender por que jobs assíncronos
  // não estão rodando (Redis down, processor travado, failedReason específico).
  @Get('nfes/diagnostico-fila')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT')
  diagnosticoFila() {
    return this.nfe.diagnosticarFilaBullMQ();
  }

  // ── Reprocessar webhooks pendentes (admin) ────────────────────────────────
  //
  // Chama processarWebhook sincronamente para todos os webhooks do tenant com
  // status 'pendente' ou 'erro'. Útil quando BullMQ estiver atrasado,
  // indisponível, ou para re-processar webhooks que falharam por bug agora
  // corrigido (ex: XML mal parseado).
  @Post('nfes/reprocessar-pendentes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.OK)
  reprocessarPendentes(@TenantId() tenantId: number) {
    return this.nfe.reprocessarWebhooksPendentes(tenantId);
  }

  // ── Listagem (autenticada) ────────────────────────────────────────────────

  @Get('locais/:localId/nfes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @Param('localId', ParseIntPipe) localId: number,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.nfe.listar(tenantId, {
      localId,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('nfes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listarGlobal(
    @TenantId() tenantId: number,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.nfe.listar(tenantId, {
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // ── Detalhe ───────────────────────────────────────────────────────────────

  @Get('nfes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  buscar(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.nfe.buscarOuFalhar(tenantId, id);
  }

  // ── Vincular OC ───────────────────────────────────────────────────────────

  @Patch('nfes/:id/vincular-oc')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  vincularOc(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VincularOcDto,
  ) {
    return this.nfe.vincularOc(tenantId, id, dto);
  }

  // ── Aceitar ───────────────────────────────────────────────────────────────

  @Post('nfes/:id/aceitar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  aceitar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AceitarNfeDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.nfe.aceitar(tenantId, id, usuarioId, dto);
  }

  // ── Rejeitar ──────────────────────────────────────────────────────────────

  @Post('nfes/:id/rejeitar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  rejeitar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejeitarNfeDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.nfe.rejeitar(tenantId, id, usuarioId, dto);
  }

  // ── Confirmar match de item ───────────────────────────────────────────────

  @Patch('nfes/:nfeId/itens/:itemId/match')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmarMatch(
    @TenantId() tenantId: number,
    @Param('nfeId', ParseIntPipe) nfeId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: ConfirmarMatchDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.nfe.confirmarMatch(tenantId, nfeId, itemId, usuarioId, dto);
  }
}
