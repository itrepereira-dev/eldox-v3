// backend/src/concretagem/concretagens/portal-fornecedor.controller.ts
import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PortalFornecedorService } from './portal-fornecedor.service';

// Endpoint público → rate-limit agressivo por IP para frear brute-force em tokens.
const PORTAL_PUBLICO_THROTTLE = {
  short: { limit: 10, ttl: 60_000 },
  long: { limit: 100, ttl: 3_600_000 },
};

// PUBLIC controller — no JwtAuthGuard
@Controller('api/v1/portal')
@Throttle(PORTAL_PUBLICO_THROTTLE)
export class PortalFornecedorController {
  constructor(private readonly svc: PortalFornecedorService) {}

  // GET /api/v1/portal/concretagem?token=xxx
  @Get('concretagem')
  @HttpCode(HttpStatus.OK)
  async verConcretagem(@Query('token') token: string) {
    if (!token?.trim()) {
      return { status: 'error', message: 'Token obrigatório' };
    }
    const data = await this.svc.buscarPorToken(token.trim());
    return { status: 'success', data };
  }
}
