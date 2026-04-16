// backend/src/fvs/dashboard/relatorio.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SemanaConformidade {
  semana: string;      // "2026-W10"
  total: number;
  aprovadas: number;
  taxa: number;        // 0–100
}

export interface LocalConformidade {
  local_id: number;
  local_nome: string;
  ultima_inspecao: string | null;  // ISO date
  itens_total: number;
  itens_ok: number;
  itens_nc: number;
  taxa: number;
}

export interface RelatorioConformidadeResponse {
  obra_nome: string;
  servico_nome: string | null;
  data_inicio: string;
  data_fim: string;
  por_semana: SemanaConformidade[];
  por_local: LocalConformidade[];
  ncs_por_criticidade: { critico: number; maior: number; menor: number };
  fichas: {
    ficha_numero: string;
    data: string;
    inspetor: string;
    local: string;
    itens_ok: number;
    itens_nc: number;
    taxa: number;
  }[];
}

@Injectable()
export class RelatorioService {
  constructor(private readonly prisma: PrismaService) {}

  async getConformidade(
    tenantId: number,
    obraId: number,
    servicoId: number | null,
    dataInicio: string,
    dataFim: string,
  ): Promise<RelatorioConformidadeResponse> {
    // Resolve obra nome
    const obraRows = await this.prisma.$queryRawUnsafe<{ nome: string }[]>(
      `SELECT nome FROM obras WHERE id = $1 AND tenant_id = $2`,
      obraId, tenantId,
    );
    const obra_nome = obraRows[0]?.nome ?? '';

    // Resolve servico nome
    let servico_nome: string | null = null;
    if (servicoId) {
      const sRows = await this.prisma.$queryRawUnsafe<{ nome: string }[]>(
        `SELECT nome FROM fvs_servicos WHERE id = $1 AND tenant_id = $2`,
        servicoId, tenantId,
      );
      servico_nome = sRows[0]?.nome ?? null;
    }

    // Base filter clause
    const servicoClause = servicoId
      ? `AND fs.servico_id = ${servicoId}`
      : '';

    // Fichas summary per local
    const fichasRows = await this.prisma.$queryRawUnsafe<{
      ficha_id: number;
      ficha_nome: string;
      created_at: string;
      inspetor_nome: string;
      local_nome: string;
      itens_ok: number;
      itens_nc: number;
    }[]>(
      `
      SELECT
        f.id AS ficha_id,
        f.nome AS ficha_nome,
        f.created_at,
        COALESCE(u.nome, 'Desconhecido') AS inspetor_nome,
        COALESCE(ol.nome, 'Sem local') AS local_nome,
        COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) AS itens_ok,
        COUNT(*) FILTER (WHERE r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho')) AS itens_nc
      FROM fvs_fichas f
      JOIN fvs_fichas_servicos fs ON fs.ficha_id = f.id
      JOIN fvs_registros r ON r.ficha_id = f.id AND r.servico_id = fs.servico_id
      LEFT JOIN fvs_fichas_servicos_locais fsl ON fsl.ficha_servico_id = fs.id
      LEFT JOIN obra_locais ol ON ol.id = fsl.obra_local_id
      LEFT JOIN users u ON u.id = f.criado_por
      WHERE f.obra_id = $1
        AND f.tenant_id = $2
        AND f.deleted_at IS NULL
        AND f.created_at >= $3
        AND f.created_at <= $4
        ${servicoClause}
      GROUP BY f.id, f.nome, f.created_at, u.nome, ol.nome
      ORDER BY f.created_at DESC
      `,
      obraId, tenantId, dataInicio, dataFim,
    );

    const fichas = fichasRows.map((row) => {
      const total = Number(row.itens_ok) + Number(row.itens_nc);
      const taxa = total > 0 ? Math.round((Number(row.itens_ok) / total) * 100) : 0;
      return {
        ficha_numero: row.ficha_nome,
        data: row.created_at,
        inspetor: row.inspetor_nome,
        local: row.local_nome,
        itens_ok: Number(row.itens_ok),
        itens_nc: Number(row.itens_nc),
        taxa,
      };
    });

    // Por semana
    const semanaRows = await this.prisma.$queryRawUnsafe<{
      semana: string;
      total: number;
      aprovadas: number;
    }[]>(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('week', r.created_at), 'IYYY-"W"IW') AS semana,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) AS aprovadas
      FROM fvs_registros r
      JOIN fvs_fichas f ON f.id = r.ficha_id
      JOIN fvs_fichas_servicos fs ON fs.ficha_id = f.id AND fs.servico_id = r.servico_id
      WHERE f.obra_id = $1
        AND f.tenant_id = $2
        AND f.deleted_at IS NULL
        AND r.created_at >= $3
        AND r.created_at <= $4
        ${servicoClause}
      GROUP BY semana
      ORDER BY semana
      `,
      obraId, tenantId, dataInicio, dataFim,
    );

    const por_semana: SemanaConformidade[] = semanaRows.map((row) => ({
      semana: row.semana,
      total: Number(row.total),
      aprovadas: Number(row.aprovadas),
      taxa: Number(row.total) > 0
        ? Math.round((Number(row.aprovadas) / Number(row.total)) * 100)
        : 0,
    }));

    // Por local
    const localRows = await this.prisma.$queryRawUnsafe<{
      local_id: number;
      local_nome: string;
      ultima_inspecao: string | null;
      itens_total: number;
      itens_ok: number;
      itens_nc: number;
    }[]>(
      `
      SELECT
        ol.id AS local_id,
        COALESCE(ol.nome, 'Sem local') AS local_nome,
        MAX(r.created_at) AS ultima_inspecao,
        COUNT(*) AS itens_total,
        COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) AS itens_ok,
        COUNT(*) FILTER (WHERE r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho')) AS itens_nc
      FROM fvs_registros r
      JOIN fvs_fichas f ON f.id = r.ficha_id
      JOIN fvs_fichas_servicos fs ON fs.ficha_id = f.id AND fs.servico_id = r.servico_id
      LEFT JOIN fvs_fichas_servicos_locais fsl ON fsl.ficha_servico_id = fs.id
      LEFT JOIN obra_locais ol ON ol.id = r.obra_local_id
      WHERE f.obra_id = $1
        AND f.tenant_id = $2
        AND f.deleted_at IS NULL
        AND r.created_at >= $3
        AND r.created_at <= $4
        ${servicoClause}
      GROUP BY ol.id, ol.nome
      ORDER BY local_nome
      `,
      obraId, tenantId, dataInicio, dataFim,
    );

    const por_local: LocalConformidade[] = localRows.map((row) => ({
      local_id: Number(row.local_id),
      local_nome: row.local_nome,
      ultima_inspecao: row.ultima_inspecao ?? null,
      itens_total: Number(row.itens_total),
      itens_ok: Number(row.itens_ok),
      itens_nc: Number(row.itens_nc),
      taxa: Number(row.itens_total) > 0
        ? Math.round((Number(row.itens_ok) / Number(row.itens_total)) * 100)
        : 0,
    }));

    // NCs por criticidade
    const ncRows = await this.prisma.$queryRawUnsafe<{ criticidade: string; total: number }[]>(
      `
      SELECT
        i.criticidade,
        COUNT(*) AS total
      FROM fvs_registros r
      JOIN fvs_fichas f ON f.id = r.ficha_id
      JOIN fvs_fichas_servicos fs ON fs.ficha_id = f.id AND fs.servico_id = r.servico_id
      JOIN fvs_itens i ON i.id = r.item_id
      WHERE f.obra_id = $1
        AND f.tenant_id = $2
        AND f.deleted_at IS NULL
        AND r.created_at >= $3
        AND r.created_at <= $4
        AND r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho')
        ${servicoClause}
      GROUP BY i.criticidade
      `,
      obraId, tenantId, dataInicio, dataFim,
    );

    const ncs_por_criticidade = { critico: 0, maior: 0, menor: 0 };
    for (const row of ncRows) {
      if (row.criticidade === 'critico') ncs_por_criticidade.critico = Number(row.total);
      else if (row.criticidade === 'maior') ncs_por_criticidade.maior = Number(row.total);
      else if (row.criticidade === 'menor') ncs_por_criticidade.menor = Number(row.total);
    }

    return {
      obra_nome,
      servico_nome,
      data_inicio: dataInicio,
      data_fim: dataFim,
      por_semana,
      por_local,
      ncs_por_criticidade,
      fichas,
    };
  }
}
