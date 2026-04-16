// frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx
// Dashboard de qualidade FVS: visão global ou por obra
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../../../../services/api'
import {
  BarChart2, CheckCircle, XCircle, AlertTriangle, TrendingUp,
  Activity, Clock, Brain,
} from 'lucide-react'
import { GraficosAvancados } from '../components/GraficosAvancados';
import { FiltrosPeriodo, useFiltrosPeriodo } from '../components/FiltrosPeriodo';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface ResumoObra {
  fichas: Array<{ status: string; total: number }>
  registros: Array<{ status: string; total: number }>
  ncs: Array<{ criticidade: string; status: string; total: number }>
  sla: { vencidas: number; no_prazo: number; sem_prazo: number }
  taxaConformidade: number | null
}

interface TaxaServico {
  servico_id: number; servico_nome: string
  total: number; conformes: number; nao_conformes: number; taxa: number
}

interface EvolucaoDia {
  data: string; conformes: number; nao_conformes: number; taxa: number
}

interface TopNc {
  servico_nome: string; item_nome: string; criticidade: string
  total: number; abertas: number
}

interface GlobalItem {
  obra_id: number; obra_nome: string; fichas_total: number
  taxa_conformidade: number | null; ncs_abertas: number; risco_score: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function taxa2color(t: number | null) {
  if (t === null) return 'var(--text-low)'
  if (t >= 90) return 'var(--ok)'
  if (t >= 70) return '#f0ad4e'
  return 'var(--nc)'
}

function criticidade2color(c: string) {
  return c === 'critico' ? 'var(--nc)' : c === 'maior' ? '#f0ad4e' : 'var(--ok)'
}

function risco2label(r: number | null) {
  if (r === null) return '—'
  if (r >= 70) return `${r} ⚠`
  if (r >= 40) return `${r} ●`
  return `${r}`
}

// ── Sub-componente: barra de conformidade ─────────────────────────────────────

function ConformidadeBar({ taxa, total }: { taxa: number; total: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-low)]">{total} registros</span>
        <span className="font-bold" style={{ color: taxa2color(taxa) }}>{taxa.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, taxa)}%`, background: taxa2color(taxa) }}
        />
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function FvsDashboardPage() {
  const { obraId } = useParams<{ obraId?: string }>()
  const numObraId = obraId ? parseInt(obraId) : null
  const [diasEvolucao, setDiasEvolucao] = useState(30)
  const [filtrosGraficos, setFiltrosGraficos] = useFiltrosPeriodo()

  const resumo = useQuery<ResumoObra>({
    queryKey: ['fvs-dashboard-resumo', numObraId],
    queryFn: () => api.get(`/fvs/dashboard/obras/${numObraId}`).then(r => r.data),
    enabled: !!numObraId,
  })

  const porServico = useQuery<TaxaServico[]>({
    queryKey: ['fvs-dashboard-servicos', numObraId],
    queryFn: () => api.get(`/fvs/dashboard/obras/${numObraId}/por-servico`).then(r => r.data),
    enabled: !!numObraId,
  })

  const evolucao = useQuery<EvolucaoDia[]>({
    queryKey: ['fvs-dashboard-evolucao', numObraId, diasEvolucao],
    queryFn: () => api.get(`/fvs/dashboard/obras/${numObraId}/evolucao?dias=${diasEvolucao}`).then(r => r.data),
    enabled: !!numObraId,
  })

  const topNcs = useQuery<TopNc[]>({
    queryKey: ['fvs-dashboard-top-ncs', numObraId],
    queryFn: () => api.get(`/fvs/dashboard/obras/${numObraId}/top-ncs?limit=10`).then(r => r.data),
    enabled: !!numObraId,
  })

  const global = useQuery<GlobalItem[]>({
    queryKey: ['fvs-dashboard-global'],
    queryFn: () => api.get(`/fvs/dashboard/global`).then(r => r.data),
    enabled: !numObraId,
  })

  const priorizacao = useMutation({
    mutationFn: () => api.post(`/fvs/dashboard/obras/${numObraId}/priorizacao`).then(r => r.data),
  })

  // ── Visão global ──────────────────────────────────────────────────────────────

  if (!numObraId) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-[var(--accent)]" />
          <h1 className="text-lg font-bold text-[var(--text-high)]">Dashboard FVS — Todas as Obras</h1>
        </div>

        {global.isLoading && <div className="text-sm text-[var(--text-low)]">Carregando…</div>}

        {global.data && (
          <div className="grid grid-cols-1 gap-3">
            {global.data.map(obra => (
              <div
                key={obra.obra_id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text-high)] truncate">{obra.obra_nome}</p>
                  <p className="text-xs text-[var(--text-low)]">{obra.fichas_total} fichas</p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-[var(--text-low)]">Conformidade</p>
                  <p className="text-lg font-bold" style={{ color: taxa2color(obra.taxa_conformidade) }}>
                    {obra.taxa_conformidade != null ? `${obra.taxa_conformidade}%` : '—'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-[var(--text-low)]">NCs abertas</p>
                  <p className="text-lg font-bold" style={{ color: obra.ncs_abertas > 0 ? 'var(--nc)' : 'var(--ok)' }}>
                    {obra.ncs_abertas}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-[var(--text-low)]">Risco IA</p>
                  <p className="text-base font-bold" style={{ color: obra.risco_score != null && obra.risco_score >= 70 ? 'var(--nc)' : 'var(--text-high)' }}>
                    {risco2label(obra.risco_score)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Visão por obra ────────────────────────────────────────────────────────────

  const r = resumo.data

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-[var(--accent)]" />
          <h1 className="text-lg font-bold text-[var(--text-high)]">Dashboard FVS</h1>
        </div>

        <button
          onClick={() => priorizacao.mutate()}
          disabled={priorizacao.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50"
        >
          <Brain size={14} />
          {priorizacao.isPending ? 'Calculando…' : 'Priorizar inspeções'}
        </button>
      </div>

      {/* Fila priorizada */}
      {priorizacao.data?.fila?.length > 0 && (
        <div className="rounded-xl border border-[var(--accent)] bg-[var(--bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--accent)] mb-3">Fila de inspeção priorizada por IA</p>
          <div className="space-y-2">
            {priorizacao.data.fila.map((item: any) => (
              <div key={item.ficha_id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--off-bg)]">
                <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {item.prioridade}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-high)] truncate">{item.ficha_titulo}</p>
                  <p className="text-xs text-[var(--text-low)]">{item.motivo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resumo.isLoading && <div className="text-sm text-[var(--text-low)]">Carregando resumo…</div>}

      {r && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
              <Activity size={20} className="mx-auto mb-1 text-[var(--accent)]" />
              <p className="text-2xl font-bold" style={{ color: taxa2color(r.taxaConformidade) }}>
                {r.taxaConformidade != null ? `${r.taxaConformidade}%` : '—'}
              </p>
              <p className="text-xs text-[var(--text-low)]">Conformidade geral</p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
              <XCircle size={20} className="mx-auto mb-1 text-[var(--nc)]" />
              <p className="text-2xl font-bold text-[var(--nc)]">
                {r.ncs.filter(n => n.status !== 'resolvida').reduce((s, n) => s + n.total, 0)}
              </p>
              <p className="text-xs text-[var(--text-low)]">NCs abertas</p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
              <Clock size={20} className="mx-auto mb-1 text-[var(--warn)]" />
              <p className="text-2xl font-bold text-[var(--warn)]">{r.sla.vencidas}</p>
              <p className="text-xs text-[var(--text-low)]">SLA vencidas</p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
              <CheckCircle size={20} className="mx-auto mb-1 text-[var(--ok)]" />
              <p className="text-2xl font-bold text-[var(--ok)]">
                {r.fichas.find(f => f.status === 'aprovada')?.total ?? 0}
              </p>
              <p className="text-xs text-[var(--text-low)]">Fichas aprovadas</p>
            </div>
          </div>

          {/* NCs por criticidade */}
          {r.ncs.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-sm font-semibold text-[var(--text-high)] mb-3">Não Conformidades por Criticidade</p>
              <div className="flex flex-wrap gap-2">
                {['critico', 'maior', 'menor'].map(crit => {
                  const total = r.ncs.filter(n => n.criticidade === crit).reduce((s, n) => s + n.total, 0)
                  if (!total) return null
                  return (
                    <div key={crit} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--off-bg)]">
                      <span className="w-2 h-2 rounded-full" style={{ background: criticidade2color(crit) }} />
                      <span className="text-sm capitalize text-[var(--text-high)]">{crit}</span>
                      <span className="text-sm font-bold" style={{ color: criticidade2color(crit) }}>{total}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Taxa por serviço */}
      {porServico.data && porServico.data.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-[var(--text-low)]" />
            <p className="text-sm font-semibold text-[var(--text-high)]">Conformidade por Serviço</p>
          </div>
          <div className="space-y-3">
            {porServico.data.map(sv => (
              <div key={sv.servico_id} className="space-y-1">
                <p className="text-sm text-[var(--text-high)] font-medium">{sv.servico_nome}</p>
                <ConformidadeBar taxa={Number(sv.taxa)} total={sv.total} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evolução temporal */}
      {evolucao.data && evolucao.data.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[var(--text-low)]" />
              <p className="text-sm font-semibold text-[var(--text-high)]">Evolução Temporal</p>
            </div>
            <div className="flex gap-1">
              {[7, 14, 30, 60].map(d => (
                <button
                  key={d}
                  onClick={() => setDiasEvolucao(d)}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${diasEvolucao === d ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-low)] bg-[var(--off-bg)]'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Tabela simplificada — sem recharts para manter sem deps extras */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-low)]">
                  <th className="text-left pb-1 font-medium">Data</th>
                  <th className="text-right pb-1 font-medium">Conformes</th>
                  <th className="text-right pb-1 font-medium">NCs</th>
                  <th className="text-right pb-1 font-medium">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {evolucao.data.slice(-15).map(dia => (
                  <tr key={dia.data}>
                    <td className="py-1 text-[var(--text-high)]">{dia.data}</td>
                    <td className="py-1 text-right text-[var(--ok)]">{dia.conformes}</td>
                    <td className="py-1 text-right text-[var(--nc)]">{dia.nao_conformes}</td>
                    <td className="py-1 text-right font-bold" style={{ color: taxa2color(Number(dia.taxa)) }}>
                      {Number(dia.taxa).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top NCs (Pareto) */}
      {topNcs.data && topNcs.data.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="text-[var(--warn)]" />
            <p className="text-sm font-semibold text-[var(--text-high)]">Top NCs — Pareto</p>
          </div>
          <div className="space-y-2">
            {topNcs.data.map((nc, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-[var(--off-bg)]">
                <span className="w-5 h-5 rounded-full bg-[var(--border)] text-xs font-bold flex items-center justify-center flex-shrink-0 text-[var(--text-low)]">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-high)] font-medium truncate">{nc.item_nome || nc.servico_nome}</p>
                  <p className="text-xs text-[var(--text-low)]">{nc.servico_nome}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: criticidade2color(nc.criticidade) }}>{nc.total}x</p>
                  {nc.abertas > 0 && <p className="text-xs text-[var(--nc)]">{nc.abertas} abertas</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Análise Visual: Gráficos Avançados ──────────────────────────────────── */}
      {numObraId && (
        <section className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold text-[var(--text-high)]">Análise Visual</h2>
            <FiltrosPeriodo value={filtrosGraficos} onChange={setFiltrosGraficos} />
          </div>
          <GraficosAvancados obraId={numObraId} filtros={filtrosGraficos} />
        </section>
      )}
    </div>
  )
}
