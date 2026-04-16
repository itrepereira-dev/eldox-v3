// backend/src/concretagem/concretagens/portal-fornecedor.controller.ts
import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { PortalFornecedorService } from './portal-fornecedor.service';

// PUBLIC controller — no JwtAuthGuard
@Controller('api/v1/portal')
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
