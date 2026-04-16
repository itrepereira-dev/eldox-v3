import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AprovacoesNotifierService {
  private readonly logger = new Logger(AprovacoesNotifierService.name);

  async notificarNovaPendente(tenantId: number, instanciaId: number): Promise<void> {
    // Fire-and-forget: busca aprovadores, envia WhatsApp
    // Por enquanto loga apenas (integração WhatsApp pode ser adicionada depois)
    this.logger.log(
      `[APROVACAO] Nova pendente: instancia=${instanciaId} tenant=${tenantId}`,
    );
  }

  async notificarDecisao(tenantId: number, instanciaId: number): Promise<void> {
    this.logger.log(`[APROVACAO] Decisão: instancia=${instanciaId} tenant=${tenantId}`);
  }

  async notificarEscalacao(tenantId: number, instanciaId: number): Promise<void> {
    this.logger.log(`[APROVACAO] Escalada: instancia=${instanciaId} tenant=${tenantId}`);
  }

  async notificarDelegacao(
    tenantId: number,
    instanciaId: number,
    novoAprovadorId: number,
  ): Promise<void> {
    this.logger.log(
      `[APROVACAO] Delegada: instancia=${instanciaId} tenant=${tenantId} para=${novoAprovadorId}`,
    );
  }
}
