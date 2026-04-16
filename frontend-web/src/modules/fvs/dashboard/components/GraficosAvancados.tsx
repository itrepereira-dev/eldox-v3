// frontend-web/src/modules/fvs/dashboard/components/GraficosAvancados.tsx
import { useDashboardGraficos } from '../hooks/useDashboardGraficos';
import { EvolucaoTemporalChart } from './EvolucaoTemporalChart';
import { ConformidadeBarChart } from './ConformidadeBarChart';
import { HeatmapServicos } from './HeatmapServicos';
import { FunilInspecoes } from './FunilInspecoes';
import type { GraficosFiltros } from '../../../../services/fvs.service';

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SkeletonCard({ height }: { height: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] ${height} animate-pulse`}
    />
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
      <p className="text-sm font-semibold text-[var(--text-high)]">{title}</p>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  obraId: number;
  filtros: GraficosFiltros;
}

export function GraficosAvancados({ obraId, filtros }: Props) {
  const { data, isLoading, isError, refetch } = useDashboardGraficos(obraId, filtros);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-64" />
        <SkeletonCard height="h-48" />
        <SkeletonCard height="h-64" />
        <SkeletonCard height="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
        <p className="text-sm text-[var(--nc)]">Erro ao carregar os gráficos</p>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Evolução Temporal da Conformidade">
        <EvolucaoTemporalChart data={data.evolucao_temporal} />
      </ChartCard>

      <ChartCard title="Conformidade por Serviço">
        <ConformidadeBarChart data={data.conformidade_por_servico} />
      </ChartCard>

      <ChartCard title="Heatmap Serviços × Período">
        <HeatmapServicos data={data.heatmap} />
      </ChartCard>

      <ChartCard title="Funil de Inspeções">
        <FunilInspecoes data={data.funil} />
      </ChartCard>
    </div>
  );
}
