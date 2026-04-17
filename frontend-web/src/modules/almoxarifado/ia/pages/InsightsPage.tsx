// frontend-web/src/modules/almoxarifado/ia/pages/InsightsPage.tsx
import { useNavigate } from 'react-router-dom'
import { Brain, RefreshCw, AlertTriangle, TrendingUp, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  useInsights,
  useAplicarSugestao,
  useIgnorarSugestao,
  useReanalisarInsights,
} from '../hooks/useInsights'
import type { AlmSugestaoIa, AlmReorderPrediction, AlmAnomaliaDetectada } from '../../_service/almoxarifado.service'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtQty(n: number, un: string) {
  return `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${un}`
}

// ── Reorder Card ───────────────────────────────────────────────────────────────

function ReorderCard({
  sugestao,
  onAplicar,
  isLoading,
}: {
  sugestao: AlmSugestaoIa
  onAplicar: (id: number) => void
  isLoading: boolean
}) {
  const p = sugestao.dados_json as AlmReorderPrediction
  const isCritico = p.nivel === 'critico'

  return (
    <div className={cn(
      'p-4 rounded-lg border',
      isCritico
        ? 'border-[var(--nc)] bg-[var(--nc-bg)]'
        : 'border-[var(--warn)] bg-[var(--warn-bg)]',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[14px] font-semibold text-[var(--text-high)] leading-tight">{sugestao.catalogo_nome}</p>
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
          <p className="font-semibold text-[var(--text-high)]">{fmtQty(p.quantidade_atual, sugestao.unidade)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Consumo/dia</span>
          <p className="font-semibold text-[var(--text-high)]">
            {p.consumo_medio_diario.toFixed(2)} {sugestao.unidade}
          </p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Dias restantes</span>
          <p className={cn('font-bold', isCritico ? 'text-[var(--nc)]' : 'text-[var(--warn)]')}>
            ~{p.dias_restantes} dias
          </p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Repor</span>
          <p className="font-semibold text-[var(--text-high)]">{fmtQty(p.recomendacao_qty, sugestao.unidade)}</p>
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-low)] italic border-t border-[var(--border-dim)] pt-2 mb-3">
        {p.analise_ia}
      </p>

      <button
        onClick={() => onAplicar(sugestao.id)}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded',
          'bg-[var(--accent)] text-white text-[12px] font-semibold',
          'hover:bg-[var(--accent-hover)] transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {isLoading ? 'Criando…' : '+ Criar Solicitação'}
      </button>
    </div>
  )
}

// ── Anomalia Card ──────────────────────────────────────────────────────────────

function AnomaliaCard({
  sugestao,
  onIgnorar,
  isLoading,
}: {
  sugestao: AlmSugestaoIa
  onIgnorar: (id: number) => void
  isLoading: boolean
}) {
  const a = sugestao.dados_json as AlmAnomaliaDetectada
  const isCritico = a.nivel === 'critico'

  return (
    <div className={cn(
      'p-4 rounded-lg border',
      isCritico
        ? 'border-[var(--nc)] bg-[var(--nc-bg)]'
        : 'border-[var(--warn)] bg-[var(--warn-bg)]',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[14px] font-semibold text-[var(--text-high)] leading-tight">{sugestao.catalogo_nome}</p>
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
          <p className="font-semibold text-[var(--text-high)]">{fmtQty(a.consumo_recente_7d, sugestao.unidade)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Consumo últimos 30d</span>
          <p className="text-[var(--text-low)]">{fmtQty(a.consumo_medio_30d, sugestao.unidade)}</p>
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-low)] italic border-t border-[var(--border-dim)] pt-2 mb-3">
        {a.explicacao_ia}
      </p>

      <button
        onClick={() => onIgnorar(sugestao.id)}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded',
          'bg-[var(--bg-raised)] border border-[var(--border-dim)]',
          'text-[12px] text-[var(--text-low)] hover:text-[var(--text-high)]',
          'disabled:opacity-50 transition-colors',
        )}
      >
        {isLoading ? 'Ignorando…' : 'Ignorar'}
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function InsightsPage() {
  const navigate = useNavigate()

  const { data = [], isLoading, isFetching } = useInsights()
  const aplicar    = useAplicarSugestao()
  const ignorar    = useIgnorarSugestao()
  const reanalisar = useReanalisarInsights()

  const reorders  = data.filter((s) => s.tipo === 'reorder')
  const anomalias = data.filter((s) => s.tipo === 'anomalia')
  const totalCritico = data.filter((s) => {
    const d = s.dados_json as any
    return d?.nivel === 'critico'
  }).length

  function handleAplicar(id: number) {
    aplicar.mutate(id, {
      onSuccess: ({ solicitacao_id }) => {
        navigate(`/almoxarifado/solicitacoes/${solicitacao_id}`)
      },
    })
  }

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
            Previsão de reposição e detecção de anomalias · análise automática a cada 6h
          </p>
        </div>

        <button
          onClick={() => reanalisar.mutate()}
          disabled={isFetching || reanalisar.isPending}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)]',
            'text-[12px] text-[var(--text-low)] hover:text-[var(--text-high)]',
            'disabled:opacity-50 transition-colors',
          )}
        >
          <RefreshCw size={12} className={cn((isFetching || reanalisar.isPending) && 'animate-spin')} />
          {reanalisar.isPending ? 'Enfileirando…' : 'Reanalisar agora'}
        </button>
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
      ) : data.length === 0 ? (
        <div className="py-16 text-center bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg">
          <Brain size={32} className="mx-auto mb-3 text-[var(--text-faint)]" />
          <p className="text-[14px] font-semibold text-[var(--text-high)] mb-1">Estoque saudável</p>
          <p className="text-[13px] text-[var(--text-faint)]">
            Nenhuma sugestão pendente · análise automática a cada 6h
          </p>
        </div>
      ) : (
        <>
          {/* Seção Reposição */}
          {reorders.length > 0 && (
            <section className="mb-8">
              <h2 className="text-[14px] font-semibold text-[var(--text-high)] flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-[var(--warn)]" />
                Reposição Prevista
                <span className="ml-1 px-1.5 py-0.5 bg-[var(--warn-bg)] text-[var(--warn)] text-[10px] font-bold rounded-full">
                  {reorders.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reorders
                  .sort((a, b) => (a.dados_json as AlmReorderPrediction).dias_restantes - (b.dados_json as AlmReorderPrediction).dias_restantes)
                  .map((s) => (
                    <ReorderCard
                      key={s.id}
                      sugestao={s}
                      onAplicar={handleAplicar}
                      isLoading={aplicar.isPending && aplicar.variables === s.id}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* Seção Anomalias */}
          {anomalias.length > 0 && (
            <section>
              <h2 className="text-[14px] font-semibold text-[var(--text-high)] flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-[var(--nc)]" />
                Anomalias de Consumo
                <span className="ml-1 px-1.5 py-0.5 bg-[var(--nc-bg)] text-[var(--nc)] text-[10px] font-bold rounded-full">
                  {anomalias.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {anomalias
                  .sort((a, b) => (b.dados_json as AlmAnomaliaDetectada).fator_desvio - (a.dados_json as AlmAnomaliaDetectada).fator_desvio)
                  .map((s) => (
                    <AnomaliaCard
                      key={s.id}
                      sugestao={s}
                      onIgnorar={(id) => ignorar.mutate(id)}
                      isLoading={ignorar.isPending && ignorar.variables === s.id}
                    />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
