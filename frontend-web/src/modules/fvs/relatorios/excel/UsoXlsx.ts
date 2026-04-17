// frontend-web/src/modules/fvs/relatorios/excel/UsoXlsx.ts
import ExcelJS from 'exceljs';
import type { R6UsoData } from '../types';

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
const BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right:  { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function applyHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = HEADER_FONT; c.fill = HEADER_FILL; c.border = BORDER;
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row.height = 22;
}

function applyData(row: ExcelJS.Row, alt: boolean) {
  row.eachCell((c) => {
    c.border = BORDER;
    c.alignment = { vertical: 'middle' };
    if (alt) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
  });
}

export async function gerarUsoXlsx(dados: R6UsoData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // Sheet 1: Por Serviço
  const ws1 = wb.addWorksheet('Por Serviço');
  ws1.columns = [
    { header: 'Serviço',          key: 'servico_nome',    width: 28 },
    { header: 'Fichas',           key: 'total_fichas',    width: 10 },
    { header: 'Registros',        key: 'total_registros', width: 12 },
    { header: 'Conformes',        key: 'registros_ok',    width: 12 },
    { header: 'Não Conformes',    key: 'registros_nc',    width: 14 },
    { header: 'Taxa (%)',         key: 'taxa',            width: 10 },
  ];
  applyHeader(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.por_servico.length === 0) {
    ws1.addRow({ servico_nome: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.por_servico.forEach((row, i) => {
      const r = ws1.addRow(row);
      applyData(r, i % 2 === 1);
      const taxaCell = r.getCell('taxa');
      if (row.taxa >= 90) taxaCell.font = { bold: true, color: { argb: 'FF16A34A' } };
      else if (row.taxa >= 70) taxaCell.font = { bold: true, color: { argb: 'FFD97706' } };
      else taxaCell.font = { bold: true, color: { argb: 'FFDC2626' } };
    });
    // Total row
    const total = ws1.addRow({
      servico_nome: 'TOTAL',
      total_fichas: dados.total_fichas,
      total_registros: dados.por_servico.reduce((s, r) => s + r.total_registros, 0),
      registros_ok: dados.por_servico.reduce((s, r) => s + r.registros_ok, 0),
      registros_nc: dados.por_servico.reduce((s, r) => s + r.registros_nc, 0),
      taxa: '',
    });
    total.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      c.border = BORDER;
    });
  }

  // Sheet 2: Por Inspetor
  const ws2 = wb.addWorksheet('Por Inspetor');
  ws2.columns = [
    { header: 'Inspetor',         key: 'inspetor_nome',      width: 28 },
    { header: 'Fichas',           key: 'total_fichas',        width: 10 },
    { header: 'Concluídas',       key: 'fichas_concluidas',   width: 12 },
    { header: '% Conclusão',      key: 'pct',                 width: 14 },
  ];
  applyHeader(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];

  dados.por_inspetor.forEach((row, i) => {
    const pct = row.total_fichas > 0
      ? Math.round((row.fichas_concluidas / row.total_fichas) * 100)
      : 0;
    const r = ws2.addRow({ ...row, pct });
    applyData(r, i % 2 === 1);
  });

  // Sheet 3: Resumo
  const ws3 = wb.addWorksheet('Resumo');
  ws3.columns = [
    { header: 'Campo',  key: 'campo',  width: 22 },
    { header: 'Valor',  key: 'valor',  width: 30 },
  ];
  applyHeader(ws3.getRow(1));
  [
    { campo: 'Obra',                   valor: dados.obra_nome },
    { campo: 'Período de',             valor: new Date(dados.data_inicio).toLocaleDateString('pt-BR') },
    { campo: 'Período até',            valor: new Date(dados.data_fim).toLocaleDateString('pt-BR') },
    { campo: 'Total de Fichas',        valor: dados.total_fichas },
    { campo: 'Serviços inspecionados', valor: dados.por_servico.length },
  ].forEach((item, i) => {
    const r = ws3.addRow(item);
    applyData(r, i % 2 === 1);
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
