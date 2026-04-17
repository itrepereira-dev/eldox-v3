// frontend-web/src/modules/concretagem/dashboard/pages/ConcretagemDashboardPage.tsx
// Hub da Concretagem — dashboard único com atalhos para sub-telas.
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
  ArrowRight,
  TrendingUp,
  Map,
} from 'lucide-react';
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard';
import { cn } from '@/lib/cn';
import { useDashboardConcretagem } from '../hooks/useDashboardConcretagem';
import DashboardFinanceiroPage from './DashboardFinanceiroPage';

function KpiCardSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-4 animate-pulse">
      <div className="h-3 w-24 bg-[var(--bg-raised)] rounded mb-3" />
      <div className="h-8 w-16 bg-[var(--bg-raised)] rounded mb-2" />
      <div className="h-3 w-32 bg-[var(--bg-raised)] rounded" />
    </div>
  );
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ── Atalho card ───────────────────────────────────────────────────────────────

interface AtalhoCardProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  tone?: 'accent' | 'ok' | 'warn';
  disabled?: boolean;
  disabledHint?: string;
}

function AtalhoCard({ icon, label, desc, onClick, tone = 'accent', disabled, disabledHint }: AtalhoCardProps) {
  const toneMap = {
    accent: 'from-[var(--accent-dim)] to-transparent border-[var(--accent)]/30 text-[var(--accent)]',
    ok:     'from-[var(--ok-dim)] to-transparent border-[var(--ok)]/30 text-[var(--ok-text)]',
    warn:   'from-[var(--warn-dim)] to-transparent border-[var(--warn)]/30 text-[var(--warn-text)]',
  };
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className={cn(
        'group relative flex items-start gap-4 p-5 rounded-xl',
        'bg-gradient-to-br border',
        'transition-all duration-[220ms] ease-out-expo',
        'text-left overflow-hidden',
        disabled
          ? 'border-[var(--border-dim)] opacity-50 cursor-not-allowed'
          : 'border-[var(--border-dim)] hover:border-[var(--accent)] hover:-translate-y-[2px] hover:shadow-md',
        !disabled && toneMap[tone],
      )}
    >
      <span className={cn(
        'flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center',
        'bg-[var(--bg-surface)] border border-[var(--border-dim)]',
        !disabled && 'group-hover:scale-110 transition-transform duration-[200ms]',
      )}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-high)] mb-0.5">{label}</p>
        <p className="text-xs text-[var(--text-faint)] leading-relaxed">
          {disabled && disabledHint ? disabledHint : desc}
        </p>
      </div>
      {!disabled && (
        <ArrowRight
          size={16}
          className="flex-shrink-0 mt-1 text-[var(--text-faint)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all duration-[200ms]"
        />
      )}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ConcretagemDashboardPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const navigate = useNavigate();
  const obraIdNum = Number(obraId) || 0;
  const [aba, setAba] = useState<'visao' | 'financeiro'>('visao');

  const { data: kpis, isLoading, isError } = useDashboardConcretagem(obraIdNum);

  const taxaVariant =
    !kpis ? 'accent'
    : kpis.taxa_aprovacao_cps >= 85 ? 'ok'
    : kpis.taxa_aprovacao_cps >= 70 ? 'warn'
    : 'nc';

  const volumePct = kpis && kpis.volume_previsto_total > 0
    ? Math.round((kpis.volume_realizado_total / kpis.volume_previsto_total) * 100)
    : 0;

  // Base path para sub-telas (quando há obra contextual vs standalone)
  const basePath = obraIdNum ? `/obras/${obraIdNum}/concretagem` : '/concretagem';

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto">

      {/* ── Header com icon badge ─────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent-dim)] to-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center">
          <FlaskConical size={22} className="text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-semibold text-[var(--text-high)] m-0 leading-tight">
            Concretagem
          </h1>
          <p className="text-sm text-[var(--text-faint)] mt-1 m-0">
            Programação, rastreabilidade e controle tecnológico de concreto (NBR 12655)
          </p>
        </div>
      </div>

      {/* ── Tabs simplificadas ──────────────────────────────────────────── */}
      <div className="flex border-b border-[var(--border-dim)]">
        {([
          { id: 'visao',      label: 'Visão Geral' },
          { id: 'financeiro', label: 'Financeiro' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAba(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              aba === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === 'financeiro' && <DashboardFinanceiroPage />}

      {aba === 'visao' && <>

      {/* ── Atalhos hero (topo para dar acesso rápido) ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AtalhoCard
          icon={<Layers size={22} className="text-[var(--accent)]" />}
          label="Gestão de Concretagens"
          desc="Kanban e lista — programar, acompanhar e lançar caminhões"
          onClick={() => navigate(`${basePath}/concretagens`)}
          tone="accent"
        />
        <AtalhoCard
          icon={<Map size={22} className="text-[var(--ok)]" />}
          label="Croqui de Rastreabilidade"
          desc="Mapa estrutural vinculando traço, caminhão e CP"
          onClick={() => navigate(`${basePath}/croqui`)}
          tone="ok"
          disabled={!obraIdNum}
          disabledHint="Selecione uma obra para acessar o croqui"
        />
        <AtalhoCard
          icon={<FlaskConical size={22} className="text-[var(--warn)]" />}
          label="Corpos de Prova"
          desc="Moldagens, rupturas pendentes e curva de resistência"
          onClick={() => navigate(`${basePath}/concretagens`)}
          tone="warn"
        />
      </div>

      {/* ── KPI Grid ───────────────────────────────────────────────────── */}
      {isError ? (
        <div className="flex items-center justify-center py-16 text-center">
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
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-low)] uppercase tracking-wide mb-3">
              Indicadores
            </h2>
            <KpiGrid cols={4}>
              <KpiCard
                label="Concretagens"
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
          </div>

          {/* ── Ranking Concreteiras ──────────────────────────────────── */}
          {kpis.ranking_concreteiras.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text-low)] uppercase tracking-wide m-0">
                  Ranking de Concreteiras
                </h2>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
                      <th className="text-left px-4 py-3 text-[var(--text-faint)] font-medium text-xs uppercase tracking-wide">Fornecedor</th>
                      <th className="text-right px-4 py-3 text-[var(--text-faint)] font-medium text-xs uppercase tracking-wide">Caminhões</th>
                      <th className="text-right px-4 py-3 text-[var(--text-faint)] font-medium text-xs uppercase tracking-wide">Volume</th>
                      <th className="text-right px-4 py-3 text-[var(--text-faint)] font-medium text-xs uppercase tracking-wide">Slump Médio</th>
                      <th className="text-right px-4 py-3 text-[var(--text-faint)] font-medium text-xs uppercase tracking-wide">Aprovação CPs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.ranking_concreteiras.map((r, idx) => (
                      <tr
                        key={r.fornecedor_id}
                        className={cn(
                          'border-b border-[var(--border-dim)] last:border-0 transition-colors',
                          'hover:bg-[var(--bg-raised)]',
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold',
                              idx === 0 ? 'bg-[var(--warn-dim)] text-[var(--warn-text)]'
                              : idx === 1 ? 'bg-[var(--bg-raised)] text-[var(--text-med)]'
                              : idx === 2 ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                              : 'bg-[var(--bg-base)] text-[var(--text-faint)]',
                            )}>
                              {idx + 1}
                            </span>
                            <span className="text-[var(--text-high)]">#{r.fornecedor_id}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--text-med)] font-mono">{r.total_caminhoes}</td>
                        <td className="px-4 py-3 text-right text-[var(--text-med)] font-mono">{r.volume_total.toFixed(1)} m³</td>
                        <td className="px-4 py-3 text-right text-[var(--text-med)] font-mono">
                          {r.slump_medio != null ? `${r.slump_medio.toFixed(1)} cm` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'font-semibold font-mono text-sm',
                            r.taxa_aprovacao_cps != null && r.taxa_aprovacao_cps >= 85 ? 'text-[var(--ok-text)]'
                            : r.taxa_aprovacao_cps != null && r.taxa_aprovacao_cps >= 70 ? 'text-[var(--warn-text)]'
                            : r.taxa_aprovacao_cps != null ? 'text-[var(--nc-text)]'
                            : 'text-[var(--text-faint)]',
                          )}>
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

      </>}
    </div>
  );
}
