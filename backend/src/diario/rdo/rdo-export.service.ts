// backend/src/diario/rdo/rdo-export.service.ts
// Sprint B1 — Exportação XLS do Diário de Obras
// Tipos de relatório:
//   1. RDO Individual (todas as seções de um RDO)
//   2. Resumo por período (lista de RDOs de uma obra em intervalo de datas)
//   3. Relatório de Mão de Obra (horas por função/período)
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const xlsx = require('xlsx');

@Injectable()
export class RdoExportService {
  private readonly logger = new Logger(RdoExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. RDO Individual ────────────────────────────────────────────────────

  async exportarRdoIndividual(tenantId: number, rdoId: number): Promise<Buffer> {
    const [rdoRows, climaRows, maoObraRows, equipamentosRows, atividadesRows, ocorrenciasRows] =
      await Promise.all([
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT r.*, o.nome AS obra_nome
           FROM rdos r
           LEFT JOIN "Obra" o ON o.id = r.obra_id
           WHERE r.id = $1 AND r.tenant_id = $2`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_clima WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY periodo`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_mao_de_obra WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_equipamentos WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_atividades WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY ordem`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM rdo_ocorrencias WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId,
          tenantId,
        ),
      ]);

    if (!rdoRows.length) {
      throw new NotFoundException(`RDO ${rdoId} não encontrado`);
    }

    const rdo = rdoRows[0];
    const wb = xlsx.utils.book_new();

    // ── Sheet 1: Informações Gerais ───────────────────────────────────────
    const infoData = [
      ['DIÁRIO DE OBRA — ELDOX', ''],
      [''],
      ['Obra', rdo.obra_nome ?? `Obra #${rdo.obra_id}`],
      ['RDO Nº', rdo.numero ?? rdo.id],
      ['Data', this.formatDate(rdo.data)],
      ['Status', (rdo.status ?? '').toUpperCase()],
      ['Resumo IA', rdo.resumo_ia ?? ''],
    ];
    const wsInfo = xlsx.utils.aoa_to_sheet(infoData);
    this.estilizarCabecalho(wsInfo, 'A1');
    xlsx.utils.book_append_sheet(wb, wsInfo, 'Informações Gerais');

    // ── Sheet 2: Clima ────────────────────────────────────────────────────
    const climaData = [
      ['Período', 'Condição', 'Praticável', 'Chuva (mm)'],
      ...climaRows.map((c) => [
        c.periodo === 'manha' ? 'Manhã' : c.periodo === 'tarde' ? 'Tarde' : 'Noite',
        (c.condicao ?? '').replace(/_/g, ' '),
        c.praticavel ? 'Sim' : 'Não',
        c.chuva_mm ?? '',
      ]),
    ];
    const wsClima = xlsx.utils.aoa_to_sheet(climaData);
    this.estilizarCabecalho(wsClima, 'A1:D1');
    xlsx.utils.book_append_sheet(wb, wsClima, 'Clima');

    // ── Sheet 3: Mão de Obra ──────────────────────────────────────────────
    const maoObraData = [
      ['Função', 'Quantidade', 'Tipo', 'Entrada', 'Saída', 'Horas Trabalhadas'],
      ...maoObraRows.map((m) => [
        m.funcao ?? '',
        m.quantidade ?? 0,
        m.tipo ?? '',
        m.hora_entrada ?? '',
        m.hora_saida ?? '',
        m.horas_trabalhadas != null ? Number(m.horas_trabalhadas) : '',
      ]),
    ];
    const wsMao = xlsx.utils.aoa_to_sheet(maoObraData);
    this.estilizarCabecalho(wsMao, 'A1:F1');
    xlsx.utils.book_append_sheet(wb, wsMao, 'Mão de Obra');

    // ── Sheet 4: Equipamentos ─────────────────────────────────────────────
    const equipData = [
      ['Descrição', 'Quantidade', 'Unidade'],
      ...equipamentosRows.map((e) => [e.descricao ?? '', e.quantidade ?? 0, e.unidade ?? '']),
    ];
    const wsEquip = xlsx.utils.aoa_to_sheet(equipData);
    this.estilizarCabecalho(wsEquip, 'A1:C1');
    xlsx.utils.book_append_sheet(wb, wsEquip, 'Equipamentos');

    // ── Sheet 5: Atividades ───────────────────────────────────────────────
    const atividadesData = [
      ['Descrição', 'Pavimento', 'Serviço', '% Executado', 'Qtd Executada', 'ID Item Orçamento'],
      ...atividadesRows.map((a) => [
        a.descricao ?? '',
        a.pavimento ?? '',
        a.servico ?? '',
        a.percentual_executado != null ? `${a.percentual_executado}%` : '',
        a.quantidade_executada != null ? Number(a.quantidade_executada) : '',
        a.orcamento_item_id ?? '',
      ]),
    ];
    const wsAtiv = xlsx.utils.aoa_to_sheet(atividadesData);
    this.estilizarCabecalho(wsAtiv, 'A1:F1');
    xlsx.utils.book_append_sheet(wb, wsAtiv, 'Atividades');

    // ── Sheet 6: Ocorrências ──────────────────────────────────────────────
    const ocorData = [
      ['Tipo', 'Descrição', 'Grau de Impacto', 'Ação Tomada'],
      ...ocorrenciasRows.map((o) => [
        (o.tipo ?? '').replace(/_/g, ' '),
        o.descricao ?? '',
        o.grau_impacto ?? '',
        o.acao_tomada ?? '',
      ]),
    ];
    const wsOcor = xlsx.utils.aoa_to_sheet(ocorData);
    this.estilizarCabecalho(wsOcor, 'A1:D1');
    xlsx.utils.book_append_sheet(wb, wsOcor, 'Ocorrências');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ─── 2. Resumo por Período ────────────────────────────────────────────────

  async exportarResumoPeriodo(
    tenantId: number,
    obraId: number,
    dataInicio: string,
    dataFim: string,
  ): Promise<Buffer> {
    const rdos = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.*, o.nome AS obra_nome,
              (SELECT COUNT(*) FROM rdo_mao_de_obra m WHERE m.rdo_id = r.id AND m.tenant_id = r.tenant_id) AS total_funcionarios,
              (SELECT COALESCE(SUM(m.quantidade), 0) FROM rdo_mao_de_obra m WHERE m.rdo_id = r.id AND m.tenant_id = r.tenant_id) AS total_homens,
              (SELECT COALESCE(SUM(m.horas_trabalhadas), 0) FROM rdo_mao_de_obra m WHERE m.rdo_id = r.id AND m.tenant_id = r.tenant_id) AS total_horas,
              (SELECT COUNT(*) FROM rdo_fotos f WHERE f.rdo_id = r.id AND f.tenant_id = r.tenant_id) AS total_fotos,
              (SELECT COUNT(*) FROM rdo_ocorrencias oc WHERE oc.rdo_id = r.id AND oc.tenant_id = r.tenant_id) AS total_ocorrencias
       FROM rdos r
       LEFT JOIN "Obra" o ON o.id = r.obra_id
       WHERE r.obra_id = $1 AND r.tenant_id = $2
         AND r.data >= $3 AND r.data <= $4
         AND r.deleted_at IS NULL
       ORDER BY r.data ASC`,
      obraId,
      tenantId,
      dataInicio,
      dataFim,
    );

    const wb = xlsx.utils.book_new();

    // ── Sheet 1: Resumo ───────────────────────────────────────────────────
    const obraNome = rdos[0]?.obra_nome ?? `Obra #${obraId}`;
    const headerMeta = [
      [`RELATÓRIO DE DIÁRIO DE OBRAS — ${obraNome}`, '', '', '', '', '', '', ''],
      [`Período: ${this.formatDate(dataInicio)} a ${this.formatDate(dataFim)}`, '', '', '', '', '', '', ''],
      [''],
    ];

    const headerCols = [
      ['RDO Nº', 'Data', 'Status', 'Funcionários', 'Total Homens', 'Horas Trabalhadas', 'Fotos', 'Ocorrências'],
    ];
    const dataRows = rdos.map((r) => [
      r.numero ?? r.id,
      this.formatDate(r.data),
      (r.status ?? '').toUpperCase(),
      Number(r.total_funcionarios),
      Number(r.total_homens),
      Number(r.total_horas),
      Number(r.total_fotos),
      Number(r.total_ocorrencias),
    ]);

    // Linha de totais
    const totals = [
      'TOTAL',
      '',
      '',
      '',
      rdos.reduce((s, r) => s + Number(r.total_homens), 0),
      rdos.reduce((s, r) => s + Number(r.total_horas), 0),
      rdos.reduce((s, r) => s + Number(r.total_fotos), 0),
      rdos.reduce((s, r) => s + Number(r.total_ocorrencias), 0),
    ];

    const wsResumo = xlsx.utils.aoa_to_sheet([...headerMeta, ...headerCols, ...dataRows, [], totals]);
    xlsx.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    // ── Sheet 2: Mão de Obra Detalhada ────────────────────────────────────
    if (rdos.length > 0) {
      const rdoIds = rdos.map((r) => r.id);
      const maoObraDetalhe = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT m.*, r.data AS rdo_data, r.numero AS rdo_numero
         FROM rdo_mao_de_obra m
         JOIN rdos r ON r.id = m.rdo_id
         WHERE m.rdo_id = ANY($1::int[]) AND m.tenant_id = $2
         ORDER BY r.data ASC, m.funcao ASC`,
        rdoIds,
        tenantId,
      );

      const maoData = [
        ['RDO Nº', 'Data', 'Função', 'Quantidade', 'Tipo', 'Entrada', 'Saída', 'Horas'],
        ...maoObraDetalhe.map((m) => [
          m.rdo_numero ?? m.rdo_id,
          this.formatDate(m.rdo_data),
          m.funcao ?? '',
          m.quantidade ?? 0,
          m.tipo ?? '',
          m.hora_entrada ?? '',
          m.hora_saida ?? '',
          m.horas_trabalhadas != null ? Number(m.horas_trabalhadas) : '',
        ]),
      ];
      const wsMao = xlsx.utils.aoa_to_sheet(maoData);
      this.estilizarCabecalho(wsMao, 'A1:H1');
      xlsx.utils.book_append_sheet(wb, wsMao, 'Mão de Obra');
    }

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ─── 3. Relatório de Horas por Função ────────────────────────────────────

  async exportarHorasPorFuncao(
    tenantId: number,
    obraId: number,
    dataInicio: string,
    dataFim: string,
  ): Promise<Buffer> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
         m.funcao,
         m.tipo,
         COUNT(DISTINCT m.rdo_id) AS dias_trabalhados,
         SUM(m.quantidade) AS total_homens,
         COALESCE(SUM(m.horas_trabalhadas), 0) AS total_horas,
         COALESCE(SUM(m.quantidade * COALESCE(m.horas_trabalhadas, 0)), 0) AS homem_horas
       FROM rdo_mao_de_obra m
       JOIN rdos r ON r.id = m.rdo_id
       WHERE r.obra_id = $1 AND r.tenant_id = $2
         AND r.data >= $3 AND r.data <= $4
         AND r.deleted_at IS NULL
       GROUP BY m.funcao, m.tipo
       ORDER BY homem_horas DESC`,
      obraId,
      tenantId,
      dataInicio,
      dataFim,
    );

    const diarioRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.data, m.funcao, m.tipo, m.quantidade,
              m.hora_entrada, m.hora_saida, m.horas_trabalhadas
       FROM rdo_mao_de_obra m
       JOIN rdos r ON r.id = m.rdo_id
       WHERE r.obra_id = $1 AND r.tenant_id = $2
         AND r.data >= $3 AND r.data <= $4
         AND r.deleted_at IS NULL
       ORDER BY r.data ASC, m.funcao ASC`,
      obraId,
      tenantId,
      dataInicio,
      dataFim,
    );

    const wb = xlsx.utils.book_new();

    // ── Sheet 1: Por Função ───────────────────────────────────────────────
    const porFuncaoData = [
      ['Função', 'Tipo', 'Dias Trabalhados', 'Total Homens', 'Total Horas', 'Homem×Hora'],
      ...rows.map((r) => [
        r.funcao,
        r.tipo,
        Number(r.dias_trabalhados),
        Number(r.total_homens),
        Number(r.total_horas),
        Number(r.homem_horas),
      ]),
      [],
      [
        'TOTAL',
        '',
        '',
        rows.reduce((s, r) => s + Number(r.total_homens), 0),
        rows.reduce((s, r) => s + Number(r.total_horas), 0),
        rows.reduce((s, r) => s + Number(r.homem_horas), 0),
      ],
    ];
    const wsFuncao = xlsx.utils.aoa_to_sheet(porFuncaoData);
    this.estilizarCabecalho(wsFuncao, 'A1:F1');
    xlsx.utils.book_append_sheet(wb, wsFuncao, 'Por Função');

    // ── Sheet 2: Detalhado por Dia ────────────────────────────────────────
    const diarData = [
      ['Data', 'Função', 'Tipo', 'Quantidade', 'Entrada', 'Saída', 'Horas'],
      ...diarioRows.map((d) => [
        this.formatDate(d.data),
        d.funcao,
        d.tipo,
        d.quantidade,
        d.hora_entrada ?? '',
        d.hora_saida ?? '',
        d.horas_trabalhadas != null ? Number(d.horas_trabalhadas) : '',
      ]),
    ];
    const wsDiario = xlsx.utils.aoa_to_sheet(diarData);
    this.estilizarCabecalho(wsDiario, 'A1:G1');
    xlsx.utils.book_append_sheet(wb, wsDiario, 'Diário de Horas');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private formatDate(val: string | Date | undefined): string {
    if (!val) return '';
    try {
      const d = typeof val === 'string' ? new Date(val + (val.includes('T') ? '' : 'T00:00:00')) : new Date(val);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return String(val);
    }
  }

  private estilizarCabecalho(ws: any, range: string): void {
    // xlsx básico não suporta estilos inline sem plugin pago (xlsx-style).
    // Registra pelo menos as larguras das colunas.
    try {
      if (!ws['!cols']) {
        ws['!cols'] = Array(10).fill({ wch: 20 });
      }
    } catch {
      // silencioso
    }
  }
}
