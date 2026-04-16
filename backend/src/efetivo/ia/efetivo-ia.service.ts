import { Injectable } from '@nestjs/common';
import { SuggesterAgent } from './agents/suggester.agent';
import { EfetivoToolsService } from './tools/efetivo.tools';
import type { SugestaoIA, AlertaEfetivo } from '../types/efetivo.types';

@Injectable()
export class EfetivoIaService {
  constructor(
    private readonly suggester: SuggesterAgent,
    private readonly tools: EfetivoToolsService,
  ) {}

  async getSugestao(tenantId: number, obraId: number, turno: string): Promise<SugestaoIA> {
    return this.suggester.sugerir(tenantId, obraId, turno);
  }

  async getAlertas(tenantId: number): Promise<AlertaEfetivo[]> {
    return this.tools.prisma.$queryRawUnsafe<AlertaEfetivo[]>(
      `SELECT * FROM efetivo_alertas WHERE tenant_id = $1 AND lido = FALSE ORDER BY criado_em DESC LIMIT 50`,
      tenantId,
    );
  }

  async marcarAlertaLido(tenantId: number, alertaId: number): Promise<void> {
    await this.tools.prisma.$executeRawUnsafe(
      `UPDATE efetivo_alertas SET lido = TRUE WHERE id = $1 AND tenant_id = $2`,
      alertaId,
      tenantId,
    );
  }
}
