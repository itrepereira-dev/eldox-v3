// frontend-web/src/modules/fvs/relatorios/excel/PendenciasXlsx.ts
import ExcelJS from 'exceljs';
import type { R3PendenciasData } from '../types';

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL_RED: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function applyHeader(row: ExcelJS.Row) {
  row.eachCell((c) => { c.font = HEADER_FONT; c.fill = HEADER_FILL_RED; c.border = BORDER; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  row.height = 22;
}

function applyData(row: ExcelJS.Row, alt: boolean) {
  row.eachCell((c) => {
    c.border = BORDER;
    c.alignment = { vertical: 'middle' };
    if (alt) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } };
  });
}

export async function gerarPendenciasXlsx(dados: R3PendenciasData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // Sheet 1: Fichas Abertas
  const ws1 = wb.addWorksheet('Fichas Abertas');
  ws1.columns = [
    { header: 'Ficha',     key: 'nome',          width: 28 },
    { header: 'Status',    key: 'status',         width: 16 },
    { header: 'Inspetor',  key: 'inspetor_nome',  width: 22 },
    { header: 'Abertura',  key: 'created_at',     width: 14 },
    { header: 'Dias',      key: 'dias_aberta',    width: 8 },
    { header: 'Prioridade',key: 'prioridade',     width: 12 },
  ];
  applyHeader(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];
  if (dados.fichas_abertas.length === 0) {
    ws1.addRow({ nome: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.fichas_abertas.forEach((f, i) => {
      const row = ws1.addRow({
        nome: f.nome,
        status: f.status,
        inspetor_nome: f.inspetor_nome,
        created_at: new Date(f.created_at).toLocaleDateString('pt-BR'),
        dias_aberta: f.dias_aberta,
        prioridade: f.dias_aberta >= 7 ? 'URGENTE' : 'NORMAL',
      });
      applyData(row, i % 2 === 1);
      if (f.dias_aberta >= 7) row.getCell('dias_aberta').font = { bold: true, color: { argb: 'FFDC2626' } };
    });
  }

  // Sheet 2: NCs sem Plano
  const ws2 = wb.addWorksheet('NCs sem Plano');
  ws2.columns = [
    { header: 'NC #',       key: 'numero',      width: 14 },
    { header: 'Título',     key: 'titulo',      width: 32 },
    { header: 'Criticidade',key: 'criticidade', width: 14 },
    { header: 'Status',     key: 'status',      width: 14 },
    { header: 'Abertura',   key: 'created_at',  width: 14 },
    { header: 'Dias',       key: 'dias_aberta', width: 8 },
  ];
  applyHeader(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  if (dados.ncs_sem_plano.length === 0) {
    ws2.addRow({ numero: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.ncs_sem_plano.forEach((nc, i) => {
      const row = ws2.addRow({
        numero: nc.numero,
        titulo: nc.titulo,
        criticidade: nc.criticidade,
        status: nc.status,
        created_at: new Date(nc.created_at).toLocaleDateString('pt-BR'),
        dias_aberta: nc.dias_aberta,
      });
      applyData(row, i % 2 === 1);
      if (nc.criticidade === 'ALTA') row.getCell('criticidade').font = { bold: true, color: { argb: 'FFDC2626' } };
    });
  }

  // Sheet 3: Planos Vencidos
  const ws3 = wb.addWorksheet('Planos Vencidos');
  ws3.columns = [
    { header: 'Título',      key: 'titulo',       width: 32 },
    { header: 'Responsável', key: 'responsavel',  width: 22 },
    { header: 'Prazo',       key: 'prazo',        width: 14 },
    { header: 'Dias Vencido',key: 'dias_vencido', width: 14 },
    { header: 'Prioridade',  key: 'prioridade',   width: 12 },
  ];
  applyHeader(ws3.getRow(1));
  ws3.views = [{ state: 'frozen', ySplit: 1 }];
  if (dados.planos_vencidos.length === 0) {
    ws3.addRow({ titulo: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.planos_vencidos.forEach((pa, i) => {
      const row = ws3.addRow({
        titulo: pa.titulo,
        responsavel: pa.responsavel ?? '—',
        prazo: pa.prazo ? new Date(pa.prazo).toLocaleDateString('pt-BR') : '—',
        dias_vencido: pa.dias_vencido,
        prioridade: pa.prioridade,
      });
      applyData(row, i % 2 === 1);
      row.getCell('dias_vencido').font = { bold: true, color: { argb: 'FFDC2626' } };
    });
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
