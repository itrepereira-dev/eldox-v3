// backend/src/fvs/inspecao/parecer.service.ts
import {
  Injectable, NotFoundException, ConflictException, UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FichaFvs } from '../types/fvs.types';
import type { SubmitParecerDto } from './dto/submit-parecer.dto';

@Injectable()
export class ParecerService {
  private readonly logger = new Logger(ParecerService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getFichaOuFalhar(tenantId: number, fichaId: number): Promise<FichaFvs> {
    const rows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
      `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      fichaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada`);
    return rows[0];
  }

  // ── solicitarParecer ─────────────────────────────────────────────────────────

  async solicitarParecer(
    tenantId: number,
    fichaId: number,
    userId: number,
    ip?: string,
  ): Promise<FichaFvs> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    if (ficha.status !== 'concluida') {
      throw new ConflictException(
        `Não é possível solicitar parecer: ficha está ${ficha.status} (esperado: concluida)`,
      );
    }

    // Verificar RO: se existe, deve estar concluido
    const roRows = await this.prisma.$queryRawUnsafe<{ id: number; status: string }[]>(
      `SELECT id, status FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 LIMIT 1`,
      fichaId, tenantId,
    );

    if (roRows.length && roRows[0].status !== 'concluido') {
      throw new ConflictException(
        'RO ainda em aberto — conclua todas as reinspeções antes de solicitar parecer',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRawUnsafe<FichaFvs[]>(
        `UPDATE fvs_fichas SET status = 'aguardando_parecer', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        fichaId, tenantId,
      );

      if (ficha.regime === 'pbqph') {
        await tx.$executeRawUnsafe(
          `INSERT INTO fvs_audit_log
             (tenant_id, ficha_id, acao, status_de, status_para, usuario_id, ip_origem, criado_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7::inet, NOW())`,
          tenantId, fichaId, 'solicitar_parecer',
          'concluida', 'aguardando_parecer', userId, ip ?? null,
        );
      }

      return updated[0];
    });
  }

  // ── submitParecer ────────────────────────────────────────────────────────────

  async submitParecer(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: SubmitParecerDto,
    ip?: string,
  ): Promise<FichaFvs> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    if (ficha.status !== 'aguardando_parecer') {
      throw new ConflictException(
        `Ficha não está aguardando parecer (status: ${ficha.status})`,
      );
    }

    // PBQP-H: observação obrigatória em rejeição
    if (ficha.regime === 'pbqph' && dto.decisao === 'rejeitado' && !dto.observacao?.trim()) {
      throw new UnprocessableEntityException(
        'PBQP-H: observação obrigatória no parecer de rejeição',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Inserir parecer (append-only)
      await tx.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO fvs_pareceres (tenant_id, ficha_id, decisao, observacao, itens_referenciados, criado_por)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
        tenantId, fichaId, dto.decisao,
        dto.observacao ?? null,
        dto.itens_referenciados ? JSON.stringify(dto.itens_referenciados) : null,
        userId,
      );

      let novoStatus: string;

      if (dto.decisao === 'aprovado') {
        novoStatus = 'aprovada';
      } else {
        // Rejeitado: criar fvs_registros ciclo+1 para todos os itens NC do ciclo atual
        const maxCicloRows = await tx.$queryRawUnsafe<{ max_ciclo: string }[]>(
          `SELECT COALESCE(MAX(ciclo), 1) AS max_ciclo FROM fvs_registros
           WHERE ficha_id = $1 AND tenant_id = $2`,
          fichaId, tenantId,
        );
        const cicloAtual = Number(maxCicloRows[0].max_ciclo);
        const novoCiclo = cicloAtual + 1;

        const itensNc = await tx.$queryRawUnsafe<{ id: number; item_id: number; servico_id: number; obra_local_id: number }[]>(
          `SELECT DISTINCT ON (item_id, obra_local_id) id, item_id, servico_id, obra_local_id
           FROM fvs_registros
           WHERE ficha_id = $1 AND tenant_id = $2 AND status = 'nao_conforme' AND ciclo = $3`,
          fichaId, tenantId, cicloAtual,
        );

        for (const item of itensNc) {
          await tx.$executeRawUnsafe(
            `INSERT INTO fvs_registros
               (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, inspecionado_por, inspecionado_em)
             VALUES ($1, $2, $3, $4, $5, $6, 'nao_avaliado', $7, NOW())
             ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO NOTHING`,
            tenantId, fichaId, item.servico_id, item.item_id, item.obra_local_id, novoCiclo, userId,
          );
        }

        novoStatus = 'em_inspecao';
      }

      const updated = await tx.$queryRawUnsafe<FichaFvs[]>(
        `UPDATE fvs_fichas SET status = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        novoStatus, fichaId, tenantId,
      );

      // Audit log (PBQP-H)
      if (ficha.regime === 'pbqph') {
        await tx.$executeRawUnsafe(
          `INSERT INTO fvs_audit_log
             (tenant_id, ficha_id, acao, status_de, status_para, usuario_id, ip_origem, detalhes, criado_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8::jsonb, NOW())`,
          tenantId, fichaId, 'emissao_parecer',
          'aguardando_parecer', novoStatus, userId, ip ?? null,
          JSON.stringify({ decisao: dto.decisao }),
        );
      }

      return updated[0];
    });
  }
}
