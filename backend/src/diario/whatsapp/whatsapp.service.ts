// backend/src/diario/whatsapp/whatsapp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import type { WhatsappWebhookResponse } from '../rdo/types/rdo.types';
import { PrismaService } from '../../prisma/prisma.service';

export interface WhatsappWebhookDto {
  numero: string;
  mensagem?: string;
  fotos?: string[];            // base64[]
  audio_transcricao?: string;
}

interface JobAgenteCampo {
  numero: string;
  mensagem?: string;
  fotos?: string[];
  audio_transcricao?: string;
  recebido_em: string;
  tenantId: number | null;
  usuarioId: number | null;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectQueue('diario') private readonly diarioQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Processa webhook do Meta Cloud API.
   * Valida a mensagem recebida e despacha job para AGENTE-CAMPO via BullMQ.
   * NÃO bloqueia o request.
   */
  async processarWebhook(dto: WhatsappWebhookDto): Promise<WhatsappWebhookResponse> {
    const start = Date.now();

    // Validar conteúdo mínimo
    const temConteudo = dto.mensagem || dto.audio_transcricao || dto.fotos?.length;
    if (!temConteudo) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          action: 'whatsapp.webhook.sem_conteudo',
          numero: dto.numero,
        }),
      );
      return {
        acao: 'ignorado',
        resumo_para_usuario: 'Mensagem vazia — nenhuma ação tomada.',
        campos_extraidos: {},
      };
    }

    // Identificar tenant/obra pelo número cadastrado
    const lookup = await this.lookupNumero(dto.numero);
    if (!lookup) {
      this.logger.warn(JSON.stringify({ level: 'warn', action: 'whatsapp.numero_nao_cadastrado', numero: dto.numero }));
      return { acao: 'ignorado', resumo_para_usuario: 'Número não cadastrado no sistema.', campos_extraidos: {} };
    }
    const { tenantId, usuarioId } = lookup;

    // Despachar job AGENTE-CAMPO (assíncrono — não bloqueia o request)
    await this.diarioQueue.add(
      'agente-campo',
      {
        numero: dto.numero,
        mensagem: dto.mensagem,
        fotos: dto.fotos,
        audio_transcricao: dto.audio_transcricao,
        recebido_em: new Date().toISOString(),
        tenantId,
        usuarioId,
      } as JobAgenteCampo,
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 1000 },
      },
    );

    const ms = Date.now() - start;
    this.logger.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date(),
        action: 'whatsapp.webhook.recebido',
        numero: dto.numero,
        tem_fotos: (dto.fotos?.length ?? 0) > 0,
        tem_audio: !!dto.audio_transcricao,
        ms,
      }),
    );

    // Resposta imediata ao Meta (o resultado real chega via WhatsApp de volta)
    return {
      acao: 'processando',
      resumo_para_usuario: 'Mensagem recebida e sendo processada pelo AGENTE-CAMPO.',
      campos_extraidos: {
        tem_fotos: (dto.fotos?.length ?? 0) > 0,
        tem_audio: !!dto.audio_transcricao,
        tem_texto: !!dto.mensagem,
      },
    };
  }

  // ─── Helpers privados ────────────────────────────────────────────────────

  private async lookupNumero(numero: string): Promise<{ tenantId: number; usuarioId: number } | null> {
    // Normaliza: remove +, espaços, traços → apenas dígitos
    const normalizado = numero.replace(/\D/g, '');
    const rows = await this.prisma.$queryRawUnsafe<{ id: number; tenantId: number }[]>(
      `SELECT id, "tenantId" FROM "Usuario"
       WHERE telefone IS NOT NULL
         AND regexp_replace(telefone, '\\D', '', 'g') = $1
         AND ativo = TRUE
       LIMIT 1`,
      normalizado,
    );
    if (!rows.length) return null;
    return { tenantId: rows[0].tenantId, usuarioId: rows[0].id };
  }
}
