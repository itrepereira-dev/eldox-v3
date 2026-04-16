// backend/src/almoxarifado/planejamento/planejamento.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmPlanejamentoItem } from '../types/alm.types';
import type { UpsertPlanejamentoDto } from './dto/upsert-planejamento.dto';

@Injectable()
export class PlanejamentoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista itens do planejamento de uma obra, com consumo realizado no mesmo mês/ano.
   */
  async listar(
    tenantId: number,
    obraId:   number,
    mes?:     number,
    ano?:     number,
  ): Promise<AlmPlanejamentoItem[]> {
    const anoRef = ano  ?? new Date().getFullYear();
    const mesRef = mes  ?? new Date().getMonth() + 1;

    return this.prisma.$queryRawUnsafe<AlmPlanejamentoItem[]>(
      `SELECT
         p.*,
         m.nome   AS catalogo_nome,
         m.codigo AS catalogo_codigo,
         COALESCE(
           (SELECT SUM(mv.quantidade)
            FROM alm_movimentos mv
            WHERE mv.tenant_id   = p.tenant_id
              AND mv.obra_id     = p.obra_id
              AND mv.catalogo_id = p.catalogo_id
              AND mv.tipo IN ('saida', 'perda')
              AND EXTRACT(MONTH FROM mv.created_at) = p.mes
              AND EXTRACT(YEAR  FROM mv.created_at) = p.ano),
           0
         ) AS consumo_realizado
       FROM alm_planejamento_itens p
       JOIN fvm_catalogo_materiais m ON m.id = p.catalogo_id
       WHERE p.tenant_id = $1
         AND p.obra_id   = $2
         AND p.mes       = $3
         AND p.ano       = $4
       ORDER BY m.nome ASC`,
      tenantId, obraId, mesRef, anoRef,
    );
  }

  /**
   * Upsert: se já existe item para (tenant, obra, catalogo, mes, ano), atualiza; senão cria.
   */
  async upsert(
    tenantId:    number,
    obraId:      number,
    usuarioId:   number,
    dto:         UpsertPlanejamentoDto,
  ): Promise<AlmPlanejamentoItem> {
    const rows = await this.prisma.$queryRawUnsafe<AlmPlanejamentoItem[]>(
      `INSERT INTO alm_planejamento_itens
         (tenant_id, obra_id, catalogo_id, mes, ano, quantidade, unidade, observacao, criado_por)
       SELECT $1, $2, $3, $4, $5, $6, m.unidade_padrao, $7, $8
       FROM fvm_catalogo_materiais m
       WHERE m.id = $3 AND m.tenant_id = $1
       ON CONFLICT (tenant_id, obra_id, catalogo_id, mes, ano)
       DO UPDATE SET
         quantidade  = EXCLUDED.quantidade,
         observacao  = EXCLUDED.observacao,
         updated_at  = now()
       RETURNING *`,
      tenantId, obraId,
      dto.catalogo_id,
      dto.mes, dto.ano,
      dto.quantidade,
      dto.observacao ?? null,
      usuarioId,
    );

    if (!rows.length) {
      throw new NotFoundException(`Material ${dto.catalogo_id} não encontrado no catálogo.`);
    }

    return rows[0];
  }

  /**
   * Remove um item do planejamento.
   */
  async remover(tenantId: number, id: number): Promise<void> {
    const affected = await this.prisma.$executeRawUnsafe(
      `DELETE FROM alm_planejamento_itens
       WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );

    if (!affected) {
      throw new NotFoundException(`Item de planejamento ${id} não encontrado.`);
    }
  }

  /**
   * Retorna todos os meses/anos com planejamento para uma obra.
   */
  async getPeriodos(tenantId: number, obraId: number): Promise<{ mes: number; ano: number; total_itens: number }[]> {
    return this.prisma.$queryRawUnsafe<{ mes: number; ano: number; total_itens: number }[]>(
      `SELECT mes, ano, COUNT(*) AS total_itens
       FROM alm_planejamento_itens
       WHERE tenant_id = $1 AND obra_id = $2
       GROUP BY mes, ano
       ORDER BY ano DESC, mes DESC`,
      tenantId, obraId,
    );
  }
}
