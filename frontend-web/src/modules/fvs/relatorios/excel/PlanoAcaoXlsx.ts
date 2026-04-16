// frontend-web/src/modules/fvs/relatorios/excel/PlanoAcaoXlsx.ts
import ExcelJS from 'exceljs';
import type { R5PlanoAcaoData } from '../types';

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function applyHeader(row: ExcelJS.Row) {
  row.eachCell((c) => { c.font = HEADER_FONT; c.fill = HEADER_FILL; c.border = BORDER; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  row.height = 22;
}

function applyData(row: ExcelJS.Row, vencido: boolean, alt: boolean) {
  row.eachCell((c) => {
    c.border = BORDER;
    c.alignment = { vertical: 'middle' };
    if (vencido) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    } else if (alt) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    }
  });
}

export async function gerarPlanoAcaoXlsx(dados: R5PlanoAcaoData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // Sheet 1: Todos os Planos
  const ws1 = wb.addWorksheet('Planos de Ação');
  ws1.columns = [
    { header: 'PA #',        key: 'numero',       width: 12 },
    { header: 'Título',      key: 'titulo',       width: 32 },
    { header: 'Origem',      key: 'origem',       width: 20 },
    { header: 'Etapa',       key: 'etapa_atual',  width: 16 },
    { header: 'Prioridade',  key: 'prioridade',   width: 12 },
    { header: 'Responsável', key: 'responsavel',  width: 22 },
    { header: 'Prazo',       key: 'prazo',        width: 14 },
    { header: 'Dias Aberto', key: 'dias_aberto',  width: 12 },
    { header: 'Vencido',     key: 'vencido',      width: 10 },
  ];
  applyHeader(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.planos.length === 0) {
    ws1.addRow({ numero: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.planos.forEach((pa, i) => {
      const row = ws1.addRow({
        numero: pa.numero,
        titulo: pa.titulo,
        origem: pa.origem,
        etapa_atual: pa.etapa_atual.replace('_', ' '),
        prioridade: pa.prioridade,
        responsavel: pa.responsavel ?? '—',
        prazo: pa.prazo ? new Date(pa.prazo).toLocaleDateString('pt-BR') : '—',
        dias_aberto: pa.dias_aberto,
        vencido: pa.vencido ? 'Sim' : 'Não',
      });
      applyData(row, pa.vencido, i % 2 === 1);
      if (pa.vencido) {
        row.getCell('vencido').font = { bold: true, color: { argb: 'FFDC2626' } };
        row.getCell('prazo').font = { bold: true, color: { argb: 'FFDC2626' } };
      }
      if (pa.prioridade === 'URGENTE') {
        row.getCell('prioridade').font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });
  }

  // Sheet 2: Resumo
  const ws2 = wb.addWorksheet('Resumo');
  ws2.columns = [
    { header: 'Métrica',     key: 'metrica',    width: 24 },
    { header: 'Quantidade',  key: 'quantidade', width: 14 },
  ];
  applyHeader(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  [
    { metrica: 'Total de Planos',           quantidade: dados.planos.length },
    { metrica: 'Abertos',                   quantidade: dados.resumo.abertos },
    { metrica: 'Em Andamento',              quantidade: dados.resumo.em_andamento },
    { metrica: 'Fechados Este Mês',         quantidade: dados.resumo.fechados_este_mes },
    { metrica: 'Vencidos',                  quantidade: dados.planos.filter((p) => p.vencido).length },
  ].forEach((item, i) => {
    const r = ws2.addRow(item);
    r.eachCell((c) => { c.border = BORDER; c.alignment = { vertical: 'middle' }; });
    if (i % 2 === 1) r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; });
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
