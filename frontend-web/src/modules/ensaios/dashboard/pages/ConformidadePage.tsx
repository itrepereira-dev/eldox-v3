// frontend-web/src/modules/ensaios/dashboard/pages/ConformidadePage.tsx
// Dashboard de Conformidade de Materiais — SPEC 5

import { useParams, useNavigate } from 'react-router-dom';
import { FlaskConical, ClipboardCheck, AlertTriangle, CalendarClock } from 'lucide-react';
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard';
import { useDashboardMateriais } from '../hooks/useDashboard';

// ── Skeleton de card ──────────────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] border-t-[3px] border-t-[var(--border-dim)] rounded-sm p-4 animate-pulse">
      <div className="h-3 w-24 bg-[var(--bg-raised)] rounded mb-3" />
      <div className="h-8 w-16 bg-[var(--bg-raised)] rounded mb-2" />
      <div className="h-3 w-32 bg-[var(--bg-raised)] rounded" />
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ConformidadePage() {
  const { obraId } = useParams<{ obraId: string }>();
  const navigate   = useNavigate();
  const obraIdNum  = Number(obraId) || 0;

  const { data: kpis, isLoading, isError } = useDashboardMateriais(obraIdNum);

  const taxaVariant = !kpis
    ? 'accent'
    : kpis.taxa_conformidade >= 85
      ? 'ok'
      : kpis.taxa_conformidade >= 70
        ? 'warn'
        : 'nc';

  return (
    <div className="p-6 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">
          Conformidade de Materiais
        </h1>
        <p className="text-sm text-[var(--text-faint)] mt-0.5 m-0">
          Indicadores de qualidade laboratorial, quarentena e próximos cupons
        </p>
      </div>

      {/* ── KPI Grid ───────────────────────────────────────────────────── */}
      {isError ? (
        <div className="flex items-center justify-center py-16 text-center px-6">
          <div>
            <p className="text-sm text-[var(--nc-text)] font-medium">Erro ao carregar indicadores</p>
            <p className="text-xs text-[var(--text-faint)] mt-1">Tente recarregar a página</p>
          </div>
        </div>
      ) : isLoading ? (
        <KpiGrid cols={4}>
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </KpiGrid>
      ) : kpis ? (
        <KpiGrid cols={4}>
          <KpiCard
            label="Taxa de Conformidade"
            value={`${kpis.taxa_conformidade.toFixed(1)}%`}
            sub={`${kpis.total_ensaios_revisados} ensaios revisados`}
            variant={taxaVariant}
            icon={<FlaskConical size={16} />}
          />
          <KpiCard
            label="Laudos Pendentes"
            value={kpis.laudos_pendentes}
            sub="Aguardando revisão"
            variant={kpis.laudos_pendentes > 0 ? 'warn' : 'ok'}
            icon={<ClipboardCheck size={16} />}
          />
          <KpiCard
            label="Lotes em Quarentena"
            value={kpis.lotes_em_quarentena}
            sub="Aguardando liberação"
            variant={kpis.lotes_em_quarentena > 0 ? 'nc' : 'ok'}
            icon={<AlertTriangle size={16} />}
          />
          <KpiCard
            label="Próximos Cupons (7d)"
            value={kpis.proximos_cupons_7d}
            sub={kpis.ensaios_vencidos > 0 ? `${kpis.ensaios_vencidos} vencido(s)` : 'Nenhum vencido'}
            variant={kpis.ensaios_vencidos > 0 ? 'nc' : kpis.proximos_cupons_7d > 0 ? 'warn' : 'ok'}
            icon={<CalendarClock size={16} />}
          />
        </KpiGrid>
      ) : null}

      {/* ── Atalhos ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {[
          {
            label: 'Ensaios Laboratoriais',
            desc: 'Registrar e acompanhar resultados',
            path: `/obras/${obraIdNum}/ensaios/laboratoriais`,
            icon: <FlaskConical size={18} />,
          },
          {
            label: 'Revisão de Laudos',
            desc: 'Aprovar ou reprovar laudos pendentes',
            path: `/obras/${obraIdNum}/ensaios/revisoes`,
            icon: <ClipboardCheck size={18} />,
          },
          {
            label: 'Tipos de Ensaio',
            desc: 'Configurar tipos e frequências',
            path: '/configuracoes/ensaios/tipos',
            icon: <AlertTriangle size={18} />,
          },
        ].map(({ label, desc, path, icon }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className="flex items-start gap-3 p-4 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)] transition-all text-left group"
          >
            <span className="mt-0.5 text-[var(--text-low)] group-hover:text-[var(--accent)] transition-colors">
              {icon}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--text-high)]">{label}</p>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>

    </div>
  );
}
