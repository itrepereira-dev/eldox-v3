// frontend-web/src/modules/concretagem/dashboard/pages/ConcretagemDashboardPage.tsx
// Dashboard de Conformidade de Concretagem — Sprint 8
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layers,
  Truck,
  FlaskConical,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
} from 'lucide-react';
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard';
import { useDashboardConcretagem } from '../hooks/useDashboardConcretagem';
import DashboardFinanceiroPage from './DashboardFinanceiroPage';

function KpiCardSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-4 animate-pulse">
      <div className="h-3 w-24 bg-[var(--bg-raised)] rounded mb-3" />
      <div className="h-8 w-16 bg-[var(--bg-raised)] rounded mb-2" />
      <div className="h-3 w-32 bg-[var(--bg-raised)] rounded" />
    </div>
  );
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

export default function ConcretagemDashboardPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const navigate = useNavigate();
  const obraIdNum = Number(obraId) || 0;
  const [aba, setAba] = useState<'conformidade' | 'financeiro'>('conformidade');

  const { data: kpis, isLoading, isError } = useDashboardConcretagem(obraIdNum);

  const taxaVariant =
    !kpis ? 'accent'
    : kpis.taxa_aprovacao_cps >= 85 ? 'ok'
    : kpis.taxa_aprovacao_cps >= 70 ? 'warn'
    : 'nc';

  const volumePct = kpis && kpis.volume_previsto_total > 0
    ? Math.round((kpis.volume_realizado_total / kpis.volume_previsto_total) * 100)
    : 0;

  return (
    <div className="p-6 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">
          Concretagem — Conformidade
        </h1>
        <p className="text-sm text-[var(--text-faint)] mt-0.5 m-0">
          Indicadores de concretagens, corpos de prova e conformidade de concreto
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--border-dim)] -mx-6 px-6 -mt-2">
        {([
          { id: 'conformidade', label: 'Conformidade' },
          { id: 'financeiro',   label: 'Financeiro' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAba(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              aba === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === 'financeiro' && <DashboardFinanceiroPage />}

      {aba === 'conformidade' && <>

      {/* KPI Grid */}
      {isError ? (
        <div className="flex items-center justify-center py-16 text-center px-6">
          <div>
            <p className="text-sm text-[var(--nc-text)] font-medium">Erro ao carregar indicadores</p>
            <p className="text-xs text-[var(--text-faint)] mt-1">Tente recarregar a página</p>
          </div>
        </div>
      ) : isLoading ? (
        <KpiGrid cols={4}>
          {[1, 2, 3, 4, 5, 6].map((i) => <KpiCardSkeleton key={i} />)}
        </KpiGrid>
      ) : kpis ? (
        <>
          <KpiGrid cols={4}>
            <KpiCard
              label="Betonadas"
              value={`${kpis.concretagens_concluidas}/${kpis.concretagens_total}`}
              sub="Concluídas / Total"
              variant={kpis.concretagens_total > 0 ? 'ok' : 'accent'}
              icon={<Layers size={16} />}
            />
            <KpiCard
              label="Volume Realizado"
              value={`${kpis.volume_realizado_total.toFixed(1)} m³`}
              sub={`${volumePct}% do previsto (${kpis.volume_previsto_total.toFixed(1)} m³)`}
              variant={volumePct >= 80 ? 'ok' : volumePct >= 50 ? 'warn' : 'accent'}
              icon={<Truck size={16} />}
            />
            <KpiCard
              label="Taxa Aprovação CPs"
              value={pct(kpis.taxa_aprovacao_cps)}
              sub={`${kpis.cps_aprovados} aprovados / ${kpis.cps_aprovados + kpis.cps_reprovados} rompidos`}
              variant={taxaVariant}
              icon={<FlaskConical size={16} />}
            />
            <KpiCard
              label="CPs Aguardando"
              value={kpis.cps_aguardando}
              sub={
                kpis.cps_vencidos_sem_resultado > 0
                  ? `${kpis.cps_vencidos_sem_resultado} vencido(s)`
                  : 'Nenhum vencido'
              }
              variant={
                kpis.cps_vencidos_sem_resultado > 0
                  ? 'nc'
                  : kpis.cps_aguardando > 0
                  ? 'warn'
                  : 'ok'
              }
              icon={<Clock size={16} />}
            />
            <KpiCard
              label="Resistência Média 28d"
              value={`${kpis.resistencia_media_28d.toFixed(1)} MPa`}
              sub="Média dos CPs de 28 dias aprovados"
              variant={kpis.resistencia_media_28d > 0 ? 'ok' : 'accent'}
              icon={<CheckCircle size={16} />}
            />
            <KpiCard
              label="NCs Abertas"
              value={kpis.ncs_abertas}
              sub="Não-conformidades de concretagem"
              variant={kpis.ncs_abertas > 0 ? 'nc' : 'ok'}
              icon={<AlertTriangle size={16} />}
            />
            <KpiCard
              label="Total de CPs"
              value={kpis.total_cps}
              sub={`${kpis.cps_aprovados} apr. · ${kpis.cps_reprovados} repr.`}
              variant="accent"
              icon={<BarChart3 size={16} />}
            />
          </KpiGrid>

          {/* Ranking Concreteiras */}
          {kpis.ranking_concreteiras.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-[var(--text-high)] mb-3">
                Ranking de Concreteiras
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-dim)]">
                      <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Fornecedor ID</th>
                      <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">Caminhões</th>
                      <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">Volume (m³)</th>
                      <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">Slump Médio</th>
                      <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">Aprovação CPs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.ranking_concreteiras.map((r) => (
                      <tr key={r.fornecedor_id} className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)]">
                        <td className="px-4 py-2 text-[var(--text-high)]">#{r.fornecedor_id}</td>
                        <td className="px-4 py-2 text-right text-[var(--text-med)]">{r.total_caminhoes}</td>
                        <td className="px-4 py-2 text-right text-[var(--text-med)]">{r.volume_total.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right text-[var(--text-med)]">
                          {r.slump_medio != null ? `${r.slump_medio.toFixed(1)} cm` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={`font-medium ${
                              r.taxa_aprovacao_cps >= 85
                                ? 'text-[var(--ok-text)]'
                                : r.taxa_aprovacao_cps >= 70
                                ? 'text-[var(--warn-text)]'
                                : 'text-[var(--nc-text)]'
                            }`}
                          >
                            {r.taxa_aprovacao_cps != null ? pct(r.taxa_aprovacao_cps) : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Atalhos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {[
          {
            label: 'Betonadas',
            desc: 'Programar e acompanhar concretagens',
            path: `/obras/${obraIdNum}/concretagem/concretagens`,
            icon: <Layers size={18} />,
          },
          {
            label: 'Croqui de Rastreabilidade',
            desc: 'Mapa SVG de elementos estruturais',
            path: `/obras/${obraIdNum}/concretagem/croqui`,
            icon: <BarChart3 size={18} />,
          },
          {
            label: 'Corpos de Prova',
            desc: 'Moldagens e rupturas pendentes',
            path: `/obras/${obraIdNum}/concretagem/concretagens`,
            icon: <FlaskConical size={18} />,
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

      </>}
    </div>
  );
}
