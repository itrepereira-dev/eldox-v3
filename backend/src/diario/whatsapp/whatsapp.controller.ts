// backend/src/diario/whatsapp/whatsapp.controller.ts
import { createHmac } from 'crypto';
import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappService, WhatsappWebhookDto } from './whatsapp.service';
import { IsString, IsOptional, IsArray } from 'class-validator';

// DTOs locais (não precisam de auth — webhook público do Meta)
class WhatsappWebhookBodyDto implements WhatsappWebhookDto {
  @IsString()
  numero: string;

  @IsString()
  @IsOptional()
  mensagem?: string;

  @IsArray()
  @IsOptional()
  fotos?: string[];

  @IsString()
  @IsOptional()
  audio_transcricao?: string;
}

/**
 * Webhook público para o Meta Cloud API.
 * NÃO usa JwtAuthGuard — autenticação via HMAC signature do Meta.
 * Ref: https://developers.facebook.com/docs/graph-api/webhooks/
 */
@Controller('api/v1/diario/whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  // TODO: injetar via ConfigService — process.env.WHATSAPP_VERIFY_TOKEN
  private readonly VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
  private readonly APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? '';

  constructor(private readonly whatsappService: WhatsappService) {}

  /**
   * GET /api/v1/diario/whatsapp/campo
   * Verificação de webhook do Meta (challenge)
   */
  @Get('campo')
  @HttpCode(HttpStatus.OK)
  verificarWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (mode === 'subscribe' && verifyToken === this.VERIFY_TOKEN) {
      this.logger.log(JSON.stringify({ level: 'info', action: 'whatsapp.webhook.verificado' }));
      return challenge;
    }
    throw new UnauthorizedException('Token de verificação inválido');
  }

  /**
   * POST /api/v1/diario/whatsapp/campo
   * Recebe mensagem do AGENTE-CAMPO via Meta Cloud API
   * Aciona AGENTE-CAMPO via BullMQ — responde imediatamente (< 5s Meta timeout)
   */
  @Post('campo')
  @HttpCode(HttpStatus.OK)
  async receberMensagem(
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: WhatsappWebhookBodyDto,
  ) {
    if (this.APP_SECRET) {
      const rawBody: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(body));
      const hmac = 'sha256=' + createHmac('sha256', this.APP_SECRET).update(rawBody).digest('hex');
      if (signature !== hmac) {
        throw new UnauthorizedException('Assinatura HMAC inválida');
      }
    } else {
      this.logger.warn(JSON.stringify({ level: 'warn', action: 'whatsapp.hmac.skip_dev_mode' }));
    }

    return this.whatsappService.processarWebhook(body);
  }
}
