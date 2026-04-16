// backend/src/ensaios/whatsapp/evolution.service.ts
//
// Env vars necessárias:
//   EVOLUTION_API_URL=http://evolution-api:8080
//   EVOLUTION_API_KEY=seu-api-key
//   EVOLUTION_API_INSTANCE=eldox
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;
  private readonly enabled: boolean;

  constructor() {
    this.baseUrl  = process.env.EVOLUTION_API_URL  ?? '';
    this.apiKey   = process.env.EVOLUTION_API_KEY   ?? '';
    this.instance = process.env.EVOLUTION_API_INSTANCE ?? 'eldox';
    this.enabled  = !!(this.baseUrl && this.apiKey);
  }

  async enviarMensagem(numero: string, texto: string): Promise<void> {
    if (!this.enabled) {
      const mascarado = `****${numero.slice(-4)}`;
      this.logger.debug(
        `Evolution API não configurada. Mensagem para ${mascarado} não enviada.`,
      );
      return;
    }

    const url = `${this.baseUrl}/message/sendText/${this.instance}`;
    const resp = await globalThis.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
      },
      body: JSON.stringify({
        number: numero,
        options: { delay: 0 },
        textMessage: { text: texto },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Evolution API retornou ${resp.status}: ${body.slice(0, 200)}`);
    }
  }
}
