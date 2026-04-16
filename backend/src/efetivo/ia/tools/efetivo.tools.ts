import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EfetivoToolsService {
  constructor(public readonly prisma: PrismaService) {}

  async getObraInfo(tenantId: number, obraId: number): Promise<unknown[]> {
    return this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, nome, tipo_obra FROM "Obra" WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
      obraId,
      tenantId,
    );
  }

  async getHistoricoEfetivo(
    tenantId: number,
    obraId: number,
    diaSemana?: number,
    turno?: string,
    limit = 30,
  ): Promise<unknown[]> {
    const conditions: string[] = [
      `re.tenant_id = $1`,
      `re.obra_id = $2`,
    ];
    const params: unknown[] = [tenantId, obraId];
    let idx = 3;

    if (diaSemana !== undefined && diaSemana !== null) {
      conditions.push(`EXTRACT(DOW FROM re.data::date) = $${idx}`);
      params.push(diaSemana);
      idx++;
    }

    if (turno) {
      conditions.push(`re.turno = $${idx}`);
      params.push(turno);
      idx++;
    }

    params.push(limit);

    const sql = `
      SELECT
        re.id,
        re.data,
        re.turno,
        re.fechado,
        EXTRACT(DOW FROM re.data::date) AS dia_semana,
        json_agg(json_build_object(
          'empresa_id',   ie.empresa_id,
          'empresa_nome', ee.nome,
          'funcao_id',    ie.funcao_id,
          'funcao_nome',  fe.nome,
          'quantidade',   ie.quantidade
        )) AS itens
      FROM registros_efetivo re
      LEFT JOIN itens_efetivo ie ON ie.registro_efetivo_id = re.id AND ie.tenant_id = re.tenant_id
      LEFT JOIN empresas_efetivo ee ON ee.id = ie.empresa_id AND ee.tenant_id = re.tenant_id
      LEFT JOIN funcoes_efetivo fe ON fe.id = ie.funcao_id AND fe.tenant_id = re.tenant_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY re.id, re.data, re.turno, re.fechado
      ORDER BY re.data DESC
      LIMIT $${idx}
    `;

    return this.prisma.$queryRawUnsafe<unknown[]>(sql, ...params);
  }

  async getEmpresasAtivas(tenantId: number): Promise<unknown[]> {
    return this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, nome, tipo FROM empresas_efetivo WHERE tenant_id=$1 AND ativa=TRUE ORDER BY nome`,
      tenantId,
    );
  }

  async getFuncoesAtivas(tenantId: number): Promise<unknown[]> {
    return this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT id, nome FROM funcoes_efetivo WHERE tenant_id=$1 AND ativa=TRUE ORDER BY nome`,
      tenantId,
    );
  }

  async upsertPadraoEfetivo(
    tenantId: number,
    obraId: number,
    diaSemana: number,
    turno: string,
    padraoJson: object,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO efetivo_padroes (tenant_id, obra_id, dia_semana, turno, padrao_json, atualizado_em)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (tenant_id, obra_id, dia_semana, turno)
       DO UPDATE SET padrao_json = EXCLUDED.padrao_json, atualizado_em = NOW()`,
      tenantId,
      obraId,
      diaSemana,
      turno,
      JSON.stringify(padraoJson),
    );
  }

  async detectarQuedaEfetivo(tenantId: number): Promise<unknown[]> {
    return this.prisma.$queryRawUnsafe<unknown[]>(
      `WITH media_7d AS (
        SELECT
          re.obra_id,
          AVG(COALESCE(totais.total_hd, 0)) AS media_hd
        FROM registros_efetivo re
        LEFT JOIN (
          SELECT registro_efetivo_id, SUM(quantidade) AS total_hd
          FROM itens_efetivo
          WHERE tenant_id = $1
          GROUP BY registro_efetivo_id
        ) totais ON totais.registro_efetivo_id = re.id
        WHERE re.tenant_id = $1
          AND re.data >= NOW() - INTERVAL '7 days'
          AND re.data < CURRENT_DATE
        GROUP BY re.obra_id
      ),
      hoje AS (
        SELECT
          re.obra_id,
          COALESCE(SUM(ie.quantidade), 0) AS total_hd_hoje
        FROM registros_efetivo re
        LEFT JOIN itens_efetivo ie ON ie.registro_efetivo_id = re.id AND ie.tenant_id = $1
        WHERE re.tenant_id = $1
          AND re.data = CURRENT_DATE
        GROUP BY re.obra_id
      )
      SELECT
        m.obra_id,
        m.media_hd,
        COALESCE(h.total_hd_hoje, 0) AS total_hd_hoje,
        ROUND(
          (1 - COALESCE(h.total_hd_hoje, 0)::numeric / NULLIF(m.media_hd, 0)) * 100, 1
        ) AS percentual_queda
      FROM media_7d m
      LEFT JOIN hoje h ON h.obra_id = m.obra_id
      WHERE m.media_hd > 0
        AND COALESCE(h.total_hd_hoje, 0) < m.media_hd * 0.5`,
      tenantId,
    );
  }

  async detectarEmpresaAusente(tenantId: number, diasMinimos = 3): Promise<unknown[]> {
    return this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT DISTINCT
        ee.id AS empresa_id,
        ee.nome AS empresa_nome,
        MAX(ie_hist.ultima_data) AS ultima_data,
        (CURRENT_DATE - MAX(ie_hist.ultima_data)::date) AS dias_ausente
      FROM empresas_efetivo ee
      LEFT JOIN LATERAL (
        SELECT MAX(re.data) AS ultima_data
        FROM itens_efetivo ie
        JOIN registros_efetivo re ON re.id = ie.registro_efetivo_id AND re.tenant_id = $1
        WHERE ie.empresa_id = ee.id AND ie.tenant_id = $1
      ) ie_hist ON TRUE
      WHERE ee.tenant_id = $1
        AND ee.ativa = TRUE
        AND (ie_hist.ultima_data IS NULL OR (CURRENT_DATE - ie_hist.ultima_data::date) >= $2)
      GROUP BY ee.id, ee.nome
      ORDER BY dias_ausente DESC NULLS FIRST`,
      tenantId,
      diasMinimos,
    );
  }

  async detectarObraParada(tenantId: number): Promise<unknown[]> {
    return this.prisma.$queryRawUnsafe<unknown[]>(
      `SELECT
        o.id AS obra_id,
        o.nome AS obra_nome,
        MAX(re.data) AS ultimo_registro,
        (NOW() - MAX(re.criado_em)) AS tempo_sem_registro
      FROM "Obra" o
      LEFT JOIN registros_efetivo re ON re.obra_id = o.id AND re.tenant_id = $1
      WHERE o.tenant_id = $1
        AND o.deleted_at IS NULL
        AND o.status = 'EM_ANDAMENTO'
      GROUP BY o.id, o.nome
      HAVING MAX(re.criado_em) < NOW() - INTERVAL '24 hours'
          OR MAX(re.criado_em) IS NULL`,
      tenantId,
    );
  }

  async criarAlerta(
    tenantId: number,
    obraId: number | null,
    tipo: string,
    severidade: string,
    mensagem: string,
    detalhes?: object,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO efetivo_alertas (tenant_id, obra_id, tipo, severidade, mensagem, detalhes, lido, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, FALSE, NOW())`,
      tenantId,
      obraId,
      tipo,
      severidade,
      mensagem,
      detalhes ? JSON.stringify(detalhes) : null,
    );
  }
}
