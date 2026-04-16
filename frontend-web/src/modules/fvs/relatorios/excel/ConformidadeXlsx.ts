// frontend-web/src/modules/fvs/relatorios/excel/ConformidadeXlsx.ts
import ExcelJS from 'exceljs';
import type { R2ConformidadeData } from '../types';

const AZUL_ELDOX = 'FF2563EB';
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ELDOX } };
const HEADER_ALIGNMENT: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
const BORDER_LIGHT: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function applyHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = BORDER_LIGHT;
  });
  row.height = 22;
}

function applyDataRow(row: ExcelJS.Row, isAlt: boolean) {
  row.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', wrapText: false };
    cell.border = BORDER_LIGHT;
    if (isAlt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    }
  });
}

export async function gerarConformidadeXlsx(dados: R2ConformidadeData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // ── Sheet 1: Fichas ─────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Fichas Inspecionadas');
  ws1.columns = [
    { header: 'Ficha #',   key: 'ficha_numero', width: 22 },
    { header: 'Data',      key: 'data',         width: 14 },
    { header: 'Inspetor',  key: 'inspetor',     width: 22 },
    { header: 'Local',     key: 'local',        width: 22 },
    { header: 'Itens OK',  key: 'itens_ok',     width: 10 },
    { header: 'Itens NC',  key: 'itens_nc',     width: 10 },
    { header: 'Taxa %',    key: 'taxa',         width: 10 },
  ];

  applyHeaderRow(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.fichas.length === 0) {
    const emptyRow = ws1.addRow({ ficha_numero: 'Nenhum registro encontrado' });
    emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
  } else {
    dados.fichas.forEach((f, i) => {
      const row = ws1.addRow({
        ficha_numero: f.ficha_numero,
        data: new Date(f.data).toLocaleDateString('pt-BR'),
        inspetor: f.inspetor,
        local: f.local,
        itens_ok: f.itens_ok,
        itens_nc: f.itens_nc,
        taxa: f.taxa,
      });
      applyDataRow(row, i % 2 === 1);
      // Color-code taxa
      const taxaCell = row.getCell('taxa');
      taxaCell.value = `${f.taxa}%`;
      taxaCell.font = {
        bold: true,
        color: {
          argb: f.taxa >= 80 ? 'FF16A34A' : f.taxa >= 60 ? 'FFD97706' : 'FFDC2626',
        },
      };
    });
  }

  // ── Sheet 2: Taxa por Semana ─────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Taxa por Semana');
  ws2.columns = [
    { header: 'Semana',    key: 'semana',    width: 16 },
    { header: 'Total',     key: 'total',     width: 10 },
    { header: 'Aprovadas', key: 'aprovadas', width: 12 },
    { header: 'Taxa %',    key: 'taxa',      width: 10 },
  ];
  applyHeaderRow(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.por_semana.length === 0) {
    const emptyRow = ws2.addRow({ semana: 'Sem dados no período' });
    emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
  } else {
    dados.por_semana.forEach((s, i) => {
      const row = ws2.addRow({ semana: s.semana, total: s.total, aprovadas: s.aprovadas, taxa: `${s.taxa}%` });
      applyDataRow(row, i % 2 === 1);
    });
  }

  // ── Sheet 3: NCs por Criticidade ─────────────────────────────────────────────
  const ws3 = wb.addWorksheet('NCs por Criticidade');
  ws3.columns = [
    { header: 'Criticidade', key: 'criticidade', width: 18 },
    { header: 'Quantidade',  key: 'quantidade',  width: 14 },
  ];
  applyHeaderRow(ws3.getRow(1));
  ws3.views = [{ state: 'frozen', ySplit: 1 }];
  [
    { criticidade: 'Crítico', quantidade: dados.ncs_por_criticidade.critico },
    { criticidade: 'Maior',   quantidade: dados.ncs_por_criticidade.maior },
    { criticidade: 'Menor',   quantidade: dados.ncs_por_criticidade.menor },
  ].forEach((row, i) => {
    const r = ws3.addRow(row);
    applyDataRow(r, i % 2 === 1);
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
