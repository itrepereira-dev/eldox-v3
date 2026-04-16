// frontend-web/src/modules/concretagem/dashboard/pages/DashboardFinanceiroPage.tsx
// Dashboard Financeiro de Concretagem — taxas, contestações, ranking avançado

import { useParams } from 'react-router-dom';
import { BarChart3, Truck, TrendingDown, TrendingUp } from 'lucide-react';
import { useDashboardFinanceiro } from '../hooks/useDashboardConcretagem';

function fmt(n: number, dec = 1) {
  return n.toFixed(dec);
}

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
      <p className="text-xs text-[var(--text-faint)] font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? 'var(--text-high)' }}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-faint)] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardFinanceiroPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const obraIdNum = Number(obraId) || 0;

  const { data: fin, isLoading, isError } = useDashboardFinanceiro(obraIdNum);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-6 w-48 bg-[var(--bg-raised)] rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !fin) {
    return (
      <div className="p-6 flex items-center justify-center py-16">
        <p className="text-sm text-[var(--nc-text)]">Erro ao carregar dados financeiros</p>
      </div>
    );
  }

  const pctMuleta = fin.total_cancelamentos > 0
    ? Math.round((fin.cancelamentos_com_multa / fin.total_cancelamentos) * 100)
    : 0;

  return (
    <div className="p-6 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">
          Concretagem — Financeiro
        </h1>
        <p className="text-sm text-[var(--text-faint)] mt-0.5 m-0">
          Taxas, contestações e ranking avançado de concreteiras
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Cancelamentos c/ Multa"
          value={fin.cancelamentos_com_multa}
          sub={`de ${fin.total_cancelamentos} cancelamentos (${pctMuleta}%)`}
          color={fin.cancelamentos_com_multa > 0 ? 'var(--nc-text)' : undefined}
        />
        <StatCard
          label="Volume Contestado (Não Pagar)"
          value={`${fmt(fin.volume_contestado_m3)} m³`}
          sub="Sobra a contestar com a concreteira"
          color={fin.volume_contestado_m3 > 0 ? 'var(--warn-text)' : undefined}
        />
        <StatCard
          label="Caminhões Não Descarregaram"
          value={fin.caminhoes_nao_descarregaram}
          sub="Rejeições documentadas"
          color={fin.caminhoes_nao_descarregaram > 0 ? 'var(--warn-text)' : undefined}
        />
        <StatCard
          label="Volume Descartado"
          value={`${fmt(fin.volume_descartado_m3)} m³`}
          sub={`+ ${fmt(fin.volume_aproveitado_m3)} m³ aproveitado`}
        />
      </div>

      {/* Por Traço */}
      {fin.por_traco.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
            <BarChart3 size={15} className="text-[var(--accent)]" />
            Previsto × Realizado por Traço
          </h2>
          <div className="rounded-xl border border-[var(--border-dim)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[var(--text-faint)] bg-[var(--bg-raised)]">
                  <th className="text-left px-4 py-2.5 font-medium">Traço</th>
                  <th className="text-right px-4 py-2.5 font-medium">Concretagens</th>
                  <th className="text-right px-4 py-2.5 font-medium">Prev. (m³)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Real. (m³)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Δ</th>
                  <th className="text-right px-4 py-2.5 font-medium">Resist. 28d</th>
                  <th className="text-right px-4 py-2.5 font-medium">% CP OK</th>
                </tr>
              </thead>
              <tbody>
                {fin.por_traco.map((row, i) => {
                  const delta = row.volume_realizado - row.volume_previsto;
                  const pct = row.volume_previsto > 0
                    ? Math.round((row.volume_realizado / row.volume_previsto) * 100)
                    : 0;
                  return (
                    <tr key={i} className="border-t border-[var(--border-dim)] hover:bg-[var(--bg-raised)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-high)]">{row.traco}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--text-faint)]">{row.total_betonadas}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--text-faint)]">{fmt(row.volume_previsto)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-[var(--text-high)]">{fmt(row.volume_realizado)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-0.5 text-xs font-semibold" style={{ color: delta > 0 ? 'var(--ok-text)' : delta < 0 ? 'var(--warn-text)' : 'var(--text-faint)' }}>
                          {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : null}
                          {pct}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[var(--text-faint)]">
                        {row.resistencia_media_28d != null ? `${fmt(row.resistencia_media_28d)} MPa` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs font-semibold" style={{ color: row.taxa_aprovacao_cps >= 85 ? 'var(--ok-text)' : row.taxa_aprovacao_cps >= 70 ? 'var(--warn-text)' : 'var(--nc-text)' }}>
                          {fmt(row.taxa_aprovacao_cps)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ranking Avançado */}
      {fin.ranking_avancado.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
            <Truck size={15} className="text-[var(--accent)]" />
            Ranking de Concreteiras
          </h2>
          <div className="rounded-xl border border-[var(--border-dim)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[var(--text-faint)] bg-[var(--bg-raised)]">
                  <th className="text-left px-4 py-2.5 font-medium">Concreteira</th>
                  <th className="text-right px-4 py-2.5 font-medium">Caminhões</th>
                  <th className="text-right px-4 py-2.5 font-medium">Volume (m³)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Não Desc.</th>
                  <th className="text-right px-4 py-2.5 font-medium">Contestado</th>
                  <th className="text-right px-4 py-2.5 font-medium">A/C Médio</th>
                  <th className="text-right px-4 py-2.5 font-medium">Slump Médio</th>
                  <th className="text-right px-4 py-2.5 font-medium">% CP OK</th>
                </tr>
              </thead>
              <tbody>
                {fin.ranking_avancado.map((row, i) => (
                  <tr key={row.fornecedor_id} className="border-t border-[var(--border-dim)] hover:bg-[var(--bg-raised)] transition-colors">
                    <td className="px-4 py-2.5 font-medium text-[var(--text-high)]">
                      <span className="text-xs text-[var(--text-faint)] mr-1.5">#{i + 1}</span>
                      {row.fornecedor_nome}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--text-faint)]">{row.total_caminhoes}</td>
                    <td className="px-4 py-2.5 text-right text-[var(--text-faint)]">{fmt(row.volume_total)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span style={{ color: row.caminhoes_nao_descarregaram > 0 ? 'var(--nc-text)' : 'var(--text-faint)' }}>
                        {row.caminhoes_nao_descarregaram}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span style={{ color: row.volume_contestado > 0 ? 'var(--warn-text)' : 'var(--text-faint)' }}>
                        {row.volume_contestado > 0 ? `${fmt(row.volume_contestado)} m³` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--text-faint)]">
                      {row.fator_ac_medio != null ? fmt(row.fator_ac_medio, 3) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--text-faint)]">
                      {row.slump_medio != null ? `${fmt(row.slump_medio)} cm` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-semibold" style={{ color: row.taxa_aprovacao_cps >= 85 ? 'var(--ok-text)' : row.taxa_aprovacao_cps >= 70 ? 'var(--warn-text)' : 'var(--nc-text)' }}>
                        {fmt(row.taxa_aprovacao_cps)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
