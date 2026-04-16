// frontend-web/src/modules/fvm/relatorios/excel/NcsFvmXlsx.ts
import ExcelJS from 'exceljs';
import type { FvmNcRelatorio } from '@/services/fvm.service';

export async function downloadNcsFvmXlsx(
  ncs: FvmNcRelatorio[],
  obraNome?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  const ws = wb.addWorksheet('NCs FVM', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // ── Column definitions ───────────────────────────────────────────────────
  ws.columns = [
    { header: 'NC #',        key: 'numero',          width: 12 },
    { header: 'Lote',        key: 'lote_numero',     width: 16 },
    { header: 'Material',    key: 'material_nome',   width: 24 },
    { header: 'Fornecedor',  key: 'fornecedor_nome', width: 28 },
    { header: 'Criticidade', key: 'criticidade',     width: 13 },
    { header: 'Tipo',        key: 'tipo',            width: 14 },
    { header: 'Status',      key: 'status',          width: 14 },
    { header: 'Prazo',       key: 'prazo',           width: 14 },
    { header: 'SLA',         key: 'sla',             width: 10 },
    { header: 'Ação Imediata', key: 'acao_imediata', width: 34 },
  ];

  // ── Header row styles ────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);
  headerRow.font    = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  headerRow.height  = 22;
  headerRow.alignment = { vertical: 'middle' };

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Data rows ─────────────────────────────────────────────────────────────
  ncs.forEach((nc) => {
    const row = ws.addRow({
      numero:          nc.numero,
      lote_numero:     nc.lote_numero,
      material_nome:   nc.material_nome,
      fornecedor_nome: nc.fornecedor_nome,
      criticidade:     nc.criticidade,
      tipo:            nc.tipo,
      status:          nc.status,
      prazo:           nc.prazo ?? '',
      sla:             nc.sla_ok ? 'No prazo' : 'Vencida',
      acao_imediata:   nc.acao_imediata ?? '',
    });

    // Color criticidade cell
    const critCell = row.getCell('criticidade');
    if (nc.criticidade === 'critico') {
      critCell.font = { bold: true, color: { argb: 'FF991B1B' } };
      critCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    } else if (nc.criticidade === 'maior') {
      critCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    }

    // Color SLA cell
    const slaCell = row.getCell('sla');
    slaCell.font = { color: { argb: nc.sla_ok ? 'FF065F46' : 'FF991B1B' } };
  });

  // ── Summary sheet ─────────────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Resumo');
  wsSummary.addRow(['Resumo NCs FVM', obraNome ?? '']).font = { bold: true, size: 12 };
  wsSummary.addRow([]);
  wsSummary.addRow(['Total NCs',         ncs.length]);
  wsSummary.addRow(['Críticas',          ncs.filter(n => n.criticidade === 'critico').length]);
  wsSummary.addRow(['Maiores',           ncs.filter(n => n.criticidade === 'maior').length]);
  wsSummary.addRow(['Menores',           ncs.filter(n => n.criticidade === 'menor').length]);
  wsSummary.addRow(['SLA no prazo',      ncs.filter(n => n.sla_ok).length]);
  wsSummary.addRow(['SLA vencidas',      ncs.filter(n => !n.sla_ok).length]);
  wsSummary.addRow(['Gerado em',         new Date().toLocaleString('pt-BR')]);

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `ncs-fvm-${Date.now()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
