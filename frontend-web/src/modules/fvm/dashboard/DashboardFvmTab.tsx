// frontend-web/src/modules/fvm/dashboard/DashboardFvmTab.tsx
import { useState } from 'react';
import { useFvmDashboard } from './hooks/useFvmDashboard';
import { FvmKpiCards } from './components/FvmKpiCards';
import { AprovacaoCategoriaChart } from './components/AprovacaoCategoriaChart';
import { EvolucaoLotesChart } from './components/EvolucaoLotesChart';
import { fvmService } from '@/services/fvm.service';
import { downloadNcsFvmPdf } from '../relatorios/pdf/NcsFvmPdf';
import { downloadNcsFvmXlsx } from '../relatorios/excel/NcsFvmXlsx';
import { FileText, FileSpreadsheet } from 'lucide-react';

interface Props {
  obraId: number;
}

export function DashboardFvmTab({ obraId }: Props) {
  const [periodo, setPeriodo] = useState<'30' | '90' | '180'>('90');
  const [exportandoNcs, setExportandoNcs] = useState(false);

  const dataFim    = new Date().toISOString().slice(0, 10);
  const dataInicio = new Date(Date.now() - Number(periodo) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, isLoading, isError } = useFvmDashboard(obraId, { data_inicio: dataInicio, data_fim: dataFim });

  async function exportarNcs(formato: 'pdf' | 'xlsx') {
    setExportandoNcs(true);
    try {
      const ncs = await fvmService.getNcsRelatorio(obraId);
      if (formato === 'pdf') {
        await downloadNcsFvmPdf(ncs);
      } else {
        await downloadNcsFvmXlsx(ncs);
      }
    } finally {
      setExportandoNcs(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando dashboard...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--nc-text)] text-sm">
        Erro ao carregar dados do dashboard.
      </div>
    );
  }

  // Empty state: no inspections completed yet
  const semInspecoes =
    data.kpis.lotes_aprovados === 0 &&
    data.kpis.lotes_reprovados === 0 &&
    data.kpis.lotes_em_quarentena === 0;

  return (
    <div className="pt-4">
      {/* ── Filtro de período + Export NCs ───────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-[var(--text-faint)]">Período:</span>
        {(['30', '90', '180'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={[
              'text-xs px-3 py-1 rounded-full border transition-colors',
              periodo === p
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'border-[var(--border-dim)] text-[var(--text-faint)] hover:text-[var(--text-high)]',
            ].join(' ')}
          >
            {p === '30' ? 'Últimos 30 dias' : p === '90' ? 'Últimos 90 dias' : 'Últimos 6 meses'}
          </button>
        ))}

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => exportarNcs('pdf')}
            disabled={exportandoNcs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-dim)] text-xs text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
          >
            <FileText size={13} />
            {exportandoNcs ? 'Gerando...' : 'NCs PDF'}
          </button>
          <button
            onClick={() => exportarNcs('xlsx')}
            disabled={exportandoNcs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-dim)] text-xs text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
          >
            <FileSpreadsheet size={13} />
            {exportandoNcs ? 'Gerando...' : 'NCs Excel'}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <FvmKpiCards kpis={data.kpis} />

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {semInspecoes && (
        <div className="text-center py-10 text-sm text-[var(--text-faint)] border border-dashed border-[var(--border-dim)] rounded-lg mb-6">
          Nenhuma inspeção concluída ainda — comece pela Grade de Materiais
        </div>
      )}

      {/* ── Gráficos ────────────────────────────────────────────────────── */}
      {!semInspecoes && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-[var(--border-dim)] rounded-lg p-4 bg-[var(--bg-raised)]">
            <AprovacaoCategoriaChart data={data.por_categoria} />
          </div>
          <div className="border border-[var(--border-dim)] rounded-lg p-4 bg-[var(--bg-raised)]">
            <EvolucaoLotesChart data={data.evolucao_semanal} />
          </div>
        </div>
      )}
    </div>
  );
}
