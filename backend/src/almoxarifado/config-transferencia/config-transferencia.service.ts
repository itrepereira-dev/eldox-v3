// backend/src/almoxarifado/config-transferencia/config-transferencia.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmConfigTransferencia } from '../types/alm.types';
import type { UpsertConfigTransferenciaDto } from './dto/upsert-config-transferencia.dto';

@Injectable()
export class ConfigTransferenciaService {
  private readonly logger = new Logger(ConfigTransferenciaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: number): Promise<AlmConfigTransferencia> {
    const rows = await this.prisma.$queryRawUnsafe<AlmConfigTransferencia[]>(
      `SELECT * FROM alm_config_transferencia WHERE tenant_id = $1`,
      tenantId,
    );

    if (!rows.length) {
      return {
        id: null,
        tenant_id: tenantId,
        valor_limite_direto: 0,
        roles_aprovadores: [],
        created_at: null,
        updated_at: null,
      };
    }

    return rows[0];
  }

  async upsert(tenantId: number, dto: UpsertConfigTransferenciaDto): Promise<AlmConfigTransferencia> {
    const rows = await this.prisma.$queryRawUnsafe<AlmConfigTransferencia[]>(
      `INSERT INTO alm_config_transferencia (tenant_id, valor_limite_direto, roles_aprovadores, created_at, updated_at)
       VALUES ($1, $2, $3::text[], NOW(), NOW())
       ON CONFLICT (tenant_id) DO UPDATE
         SET valor_limite_direto = EXCLUDED.valor_limite_direto,
             roles_aprovadores   = EXCLUDED.roles_aprovadores,
             updated_at          = NOW()
       RETURNING *`,
      tenantId,
      dto.valor_limite_direto,
      dto.roles_aprovadores,
    );

    this.logger.log(JSON.stringify({ action: 'alm.config_transferencia.upsert', tenantId }));
    return rows[0];
  }

  /**
   * Returns config for tenant, used internally by TransferenciasService.
   */
  async getOrDefault(tenantId: number): Promise<AlmConfigTransferencia> {
    return this.get(tenantId);
  }
}
