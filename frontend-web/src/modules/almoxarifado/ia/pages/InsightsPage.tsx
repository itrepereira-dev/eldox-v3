// frontend-web/src/modules/almoxarifado/ia/pages/InsightsPage.tsx
import { useParams } from 'react-router-dom'
import { Brain, RefreshCw, AlertTriangle, Clock, TrendingUp, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useInsights } from '../hooks/useInsights'
import type { AlmReorderPrediction, AlmAnomaliaDetectada } from '../../_service/almoxarifado.service'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtQty(n: number, un: string) {
  return `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${un}`
}

// ── Reorder Card ───────────────────────────────────────────────────────────────

function ReorderCard({ p }: { p: AlmReorderPrediction }) {
  const isCritico = p.nivel === 'critico'
  return (
    <div className={cn(
      'p-4 rounded-lg border',
      isCritico
        ? 'border-[var(--nc)] bg-[var(--nc-bg)]'
        : 'border-[var(--warn)] bg-[var(--warn-bg)]',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[14px] font-semibold text-[var(--text-high)] leading-tight">{p.catalogo_nome}</p>
        <span className={cn(
          'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
          isCritico ? 'bg-[var(--nc)] text-white' : 'bg-[var(--warn)] text-white',
        )}>
          {isCritico ? 'Crítico' : 'Atenção'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] mb-3">
        <div>
          <span className="text-[var(--text-faint)]">Estoque atual</span>
          <p className="font-mono font-semibold text-[var(--text-high)]">{fmtQty(p.quantidade_atual, p.unidade)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Consumo/dia</span>
          <p className="font-mono font-semibold text-[var(--text-high)]">
            {p.consumo_medio_diario.toFixed(2)} {p.unidade}
          </p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Dias restantes</span>
          <p className={cn('font-mono font-bold', isCritico ? 'text-[var(--nc)]' : 'text-[var(--warn)]')}>
            ~{p.dias_restantes} dias
          </p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Repor</span>
          <p className="font-mono font-semibold text-[var(--text-high)]">{fmtQty(p.recomendacao_qty, p.unidade)}</p>
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-low)] italic border-t border-[var(--border-dim)] pt-2">
        {p.analise_ia}
      </p>
    </div>
  )
}

// ── Anomalia Card ──────────────────────────────────────────────────────────────

function AnomaliaCard({ a }: { a: AlmAnomaliaDetectada }) {
  const isCritico = a.nivel === 'critico'
  return (
    <div className={cn(
      'p-4 rounded-lg border',
      isCritico
        ? 'border-[var(--nc)] bg-[var(--nc-bg)]'
        : 'border-[var(--warn)] bg-[var(--warn-bg)]',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[14px] font-semibold text-[var(--text-high)] leading-tight">{a.catalogo_nome}</p>
        <span className={cn(
          'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
          isCritico ? 'bg-[var(--nc)] text-white' : 'bg-[var(--warn)] text-white',
        )}>
          {a.fator_desvio.toFixed(1)}x desvio
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] mb-3">
        <div>
          <span className="text-[var(--text-faint)]">Consumo últimos 7d</span>
          <p className="font-mono font-semibold text-[var(--text-high)]">{fmtQty(a.consumo_recente_7d, a.unidade)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Consumo últimos 30d</span>
          <p className="font-mono text-[var(--text-low)]">{fmtQty(a.consumo_medio_30d, a.unidade)}</p>
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-low)] italic border-t border-[var(--border-dim)] pt-2">
        {a.explicacao_ia}
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function InsightsPage() {
  const { obraId } = useParams<{ obraId: string }>()
  const id = Number(obraId)

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useInsights(id)

  const analisadoEm = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleString('pt-BR')
    : null

  const totalCritico = [
    ...(data?.reorder  ?? []).filter((r) => r.nivel === 'critico'),
    ...(data?.anomalias ?? []).filter((a) => a.nivel === 'critico'),
  ].length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)] flex items-center gap-2">
            <Brain size={18} className="text-[var(--accent)]" />
            IA Preditiva
          </h1>
          <p className="text-[13px] text-[var(--text-low)] mt-0.5">
            Previsão de reposição e detecção de anomalias de consumo
          </p>
        </div>

        <div className="flex items-center gap-3">
          {analisadoEm && (
            <span className="text-[11px] text-[var(--text-faint)] flex items-center gap-1">
              <Clock size={10} /> Análise: {analisadoEm}
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded',
              'bg-[var(--bg-raised)] border border-[var(--border-dim)]',
              'text-[12px] text-[var(--text-low)] hover:text-[var(--text-high)]',
              'disabled:opacity-50 transition-colors',
            )}
          >
            <RefreshCw size={12} className={cn(isFetching && 'animate-spin')} />
            {isFetching ? 'Analisando…' : 'Reanalisar'}
          </button>
        </div>
      </div>

      {/* Alerta geral */}
      {totalCritico > 0 && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--nc-bg)] border border-[var(--nc)] text-[var(--nc)]">
          <Zap size={14} />
          <span className="text-[13px] font-semibold">
            {totalCritico} situaç{totalCritico > 1 ? 'ões' : 'ão'} crítica{totalCritico > 1 ? 's' : ''} detectada{totalCritico > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)]">
              <div className="skeleton h-4 rounded w-3/4 mb-3" />
              <div className="skeleton h-3 rounded w-1/2 mb-2" />
              <div className="skeleton h-3 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Seção Reposição */}
          <section className="mb-8">
            <h2 className="text-[14px] font-semibold text-[var(--text-high)] flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-[var(--warn)]" />
              Reposição Prevista
              {data?.reorder.length ? (
                <span className="ml-1 px-1.5 py-0.5 bg-[var(--warn-bg)] text-[var(--warn)] text-[10px] font-bold rounded-full">
                  {data.reorder.length}
                </span>
              ) : null}
            </h2>

            {!data?.reorder.length ? (
              <div className="py-8 text-center bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg">
                <AlertTriangle size={24} className="mx-auto mb-2 text-[var(--text-faint)]" />
                <p className="text-[13px] text-[var(--text-faint)]">
                  Nenhum material com previsão de ruptura nos próximos 14 dias.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.reorder
                  .sort((a, b) => a.dias_restantes - b.dias_restantes)
                  .map((p) => <ReorderCard key={p.catalogo_id} p={p} />)}
              </div>
            )}
          </section>

          {/* Seção Anomalias */}
          <section>
            <h2 className="text-[14px] font-semibold text-[var(--text-high)] flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-[var(--nc)]" />
              Anomalias de Consumo
              {data?.anomalias.length ? (
                <span className="ml-1 px-1.5 py-0.5 bg-[var(--nc-bg)] text-[var(--nc)] text-[10px] font-bold rounded-full">
                  {data.anomalias.length}
                </span>
              ) : null}
            </h2>

            {!data?.anomalias.length ? (
              <div className="py-8 text-center bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg">
                <TrendingUp size={24} className="mx-auto mb-2 text-[var(--text-faint)]" />
                <p className="text-[13px] text-[var(--text-faint)]">
                  Nenhuma anomalia de consumo detectada nos últimos 7 dias.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.anomalias
                  .sort((a, b) => b.fator_desvio - a.fator_desvio)
                  .map((a) => <AnomaliaCard key={a.catalogo_id} a={a} />)}
              </div>
            )}
          </section>

          {/* Footer modelo */}
          {data && (
            <p className="mt-6 text-[10px] text-[var(--text-faint)] text-center font-mono">
              Modelo: {data.modelo} · Analisado em: {new Date(data.analisado_em).toLocaleString('pt-BR')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
