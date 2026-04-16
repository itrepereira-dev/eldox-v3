// frontend-web/src/modules/fvm/relatorios/excel/PerformanceFornecedoresXlsx.ts
import ExcelJS from 'exceljs';
import type { FvmPerformanceFornecedor } from '@/services/fvm.service';

export async function downloadPerformanceXlsx(
  fornecedores: FvmPerformanceFornecedor[],
  periodo?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  const ws = wb.addWorksheet('Performance Fornecedores', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // ── Column definitions ───────────────────────────────────────────────────
  ws.columns = [
    { header: 'Ranking',            key: 'ranking',              width: 10 },
    { header: 'Fornecedor',         key: 'razao_social',         width: 32 },
    { header: 'CNPJ',               key: 'cnpj',                 width: 18 },
    { header: 'Total Lotes',        key: 'total_lotes',          width: 13 },
    { header: 'Taxa Aprovação (%)', key: 'taxa_aprovacao',       width: 18 },
    { header: 'Total NCs',          key: 'total_ncs',            width: 12 },
    { header: 'NCs Críticas',       key: 'ncs_criticas',         width: 14 },
    { header: 'Ensaios Reprovados', key: 'ensaios_reprovados',   width: 18 },
    { header: 'Total Ensaios',      key: 'total_ensaios',        width: 14 },
    { header: 'Score (0–100)',      key: 'score',                width: 14 },
  ];

  // ── Header row styles ────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);
  headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  headerRow.height    = 22;
  headerRow.alignment = { vertical: 'middle' };

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Data rows — sorted by score desc ─────────────────────────────────────
  const sorted = [...fornecedores].sort((a, b) => b.score - a.score);

  sorted.forEach((f, idx) => {
    const row = ws.addRow({
      ranking:            idx + 1,
      razao_social:       f.razao_social,
      cnpj:               f.cnpj ?? '',
      total_lotes:        f.total_lotes,
      taxa_aprovacao:     f.taxa_aprovacao,
      total_ncs:          f.total_ncs,
      ncs_criticas:       f.ncs_criticas,
      ensaios_reprovados: f.ensaios_reprovados,
      total_ensaios:      f.total_ensaios,
      score:              f.score,
    });

    // Score conditional formatting
    const scoreCell = row.getCell('score');
    scoreCell.font = { bold: true };
    if (f.score >= 70) {
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      scoreCell.font = { bold: true, color: { argb: 'FF065F46' } };
    } else if (f.score >= 50) {
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      scoreCell.font = { bold: true, color: { argb: 'FF92400E' } };
    } else {
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      scoreCell.font = { bold: true, color: { argb: 'FF991B1B' } };
    }

    // Flag critical NCs
    if (f.ncs_criticas > 0) {
      row.getCell('ncs_criticas').font = { bold: true, color: { argb: 'FF991B1B' } };
    }
  });

  // ── Formula sheet ─────────────────────────────────────────────────────────
  const wsInfo = wb.addWorksheet('Metodologia');
  wsInfo.addRow(['Fórmula do Score de Fornecedores — Eldox FVM']).font = { bold: true, size: 12 };
  wsInfo.addRow([]);
  wsInfo.addRow(['Score = (taxa_aprovacao × 0.5) + ((1 − ncs_criticas/total_lotes) × 100 × 0.3) + ((1 − ensaios_reprovados/total_ensaios) × 100 × 0.2)']);
  wsInfo.addRow([]);
  wsInfo.addRow(['Componente',           'Peso', 'Descrição']);
  wsInfo.addRow(['Taxa de Aprovação',    '50%',  'Percentual de lotes aprovados ou aprovados c/ ressalva']);
  wsInfo.addRow(['NCs Críticas',         '30%',  '(1 - ncs_criticas / total_lotes) × 100']);
  wsInfo.addRow(['Ensaios Reprovados',   '20%',  '(1 - ensaios_reprovados / total_ensaios) × 100']);
  wsInfo.addRow([]);
  wsInfo.addRow(['Score clamped to [0, 100]']);
  wsInfo.addRow(['Período:', periodo ?? 'Todos os tempos']);
  wsInfo.addRow(['Gerado em:', new Date().toLocaleString('pt-BR')]);

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `performance-fornecedores-${Date.now()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
