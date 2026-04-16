// frontend-web/src/modules/fvs/relatorios/excel/NcsXlsx.ts
import ExcelJS from 'exceljs';
import type { R4NcsData } from '../types';

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
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

function applyData(row: ExcelJS.Row, alt: boolean) {
  row.eachCell((c) => {
    c.border = BORDER;
    c.alignment = { vertical: 'middle' };
    if (alt) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
  });
}

export async function gerarNcsXlsx(dados: R4NcsData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // Sheet 1: NCs Detalhadas
  const ws1 = wb.addWorksheet('Não Conformidades');
  ws1.columns = [
    { header: 'NC #',        key: 'numero',        width: 12 },
    { header: 'Ficha',       key: 'ficha_nome',    width: 20 },
    { header: 'Serviço',     key: 'servico',       width: 20 },
    { header: 'Item',        key: 'item_descricao',width: 32 },
    { header: 'Criticidade', key: 'criticidade',   width: 14 },
    { header: 'Status',      key: 'status',        width: 16 },
    { header: 'Responsável', key: 'responsavel',   width: 22 },
    { header: 'Prazo',       key: 'prazo',         width: 14 },
    { header: 'Abertura',    key: 'created_at',    width: 14 },
  ];
  applyHeader(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.ncs.length === 0) {
    ws1.addRow({ numero: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    // Group rows by servico with sub-total rows
    const byServico: Record<string, typeof dados.ncs> = {};
    dados.ncs.forEach((nc) => {
      if (!byServico[nc.servico]) byServico[nc.servico] = [];
      byServico[nc.servico].push(nc);
    });
    let rowIndex = 0;
    Object.entries(byServico).forEach(([servico, ncList]) => {
      // Group header
      const groupRow = ws1.addRow({ numero: `── ${servico} (${ncList.length} NCs) ──` });
      groupRow.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        c.font = { bold: true, color: { argb: 'FF1E3A5F' } };
      });
      ws1.mergeCells(`A${groupRow.number}:I${groupRow.number}`);
      ncList.forEach((nc) => {
        const row = ws1.addRow({
          numero: nc.numero,
          ficha_nome: nc.ficha_nome,
          servico: nc.servico,
          item_descricao: nc.item_descricao,
          criticidade: nc.criticidade,
          status: nc.status,
          responsavel: nc.responsavel ?? '—',
          prazo: nc.prazo ? new Date(nc.prazo).toLocaleDateString('pt-BR') : '—',
          created_at: new Date(nc.created_at).toLocaleDateString('pt-BR'),
        });
        applyData(row, rowIndex % 2 === 1);
        if (nc.criticidade === 'ALTA') row.getCell('criticidade').font = { bold: true, color: { argb: 'FFDC2626' } };
        else if (nc.criticidade === 'MEDIA') row.getCell('criticidade').font = { bold: true, color: { argb: 'FFD97706' } };
        rowIndex++;
      });
    });
  }

  // Sheet 2: Resumo SLA
  const ws2 = wb.addWorksheet('Resumo SLA');
  ws2.columns = [
    { header: 'Métrica',     key: 'metrica',    width: 20 },
    { header: 'Quantidade',  key: 'quantidade', width: 14 },
  ];
  applyHeader(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  [
    { metrica: 'No Prazo',    quantidade: dados.sla.no_prazo },
    { metrica: 'Vencidas',    quantidade: dados.sla.vencidas },
    { metrica: 'Sem Prazo',   quantidade: dados.sla.sem_prazo },
    { metrica: 'Alta',        quantidade: dados.por_criticidade.alta },
    { metrica: 'Média',       quantidade: dados.por_criticidade.media },
    { metrica: 'Baixa',       quantidade: dados.por_criticidade.baixa },
  ].forEach((item, i) => {
    const r = ws2.addRow(item);
    applyData(r, i % 2 === 1);
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
