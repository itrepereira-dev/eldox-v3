// frontend-web/src/modules/almoxarifado/compras/pages/OcListPage.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, Package } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useOcs } from '../hooks/useCompras'
import type { AlmOrdemCompra, AlmOcStatus } from '../../_service/almoxarifado.service'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AlmOcStatus, string> = {
  rascunho:                'Rascunho',
  confirmada:              'Confirmada',
  emitida:                 'Emitida',
  parcialmente_recebida:   'Parc. Recebida',
  recebida:                'Recebida',
  cancelada:               'Cancelada',
}

const STATUS_STYLE: Record<AlmOcStatus, string> = {
  rascunho:               'bg-[var(--off-bg)] text-[var(--off)]',
  confirmada:             'bg-[var(--warn-bg)] text-[var(--warn)]',
  emitida:                'bg-[var(--run-bg)] text-[var(--run)]',
  parcialmente_recebida:  'bg-[var(--warn-bg)] text-[var(--warn)]',
  recebida:               'bg-[var(--ok-bg)] text-[var(--ok)]',
  cancelada:              'bg-[var(--off-bg)] text-[var(--off)]',
}

const TABS: Array<{ label: string; value: string }> = [
  { label: 'Todas',        value: '' },
  { label: 'Em Aberto',    value: 'emitida' },
  { label: 'Confirmadas',  value: 'confirmada' },
  { label: 'Recebidas',    value: 'recebida' },
  { label: 'Rascunhos',   value: 'rascunho' },
]

// ── Row ────────────────────────────────────────────────────────────────────────

function OcRow({ oc }: { oc: AlmOrdemCompra }) {
  function fmtVal(val: number | null) {
    if (val == null) return '—'
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  function fmtData(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  return (
    <tr className="hover:bg-[var(--bg-raised)] transition-colors">
      <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--accent)] font-semibold">
        <Link to={`/almoxarifado/ocs/${oc.id}`} className="hover:underline">
          {oc.numero}
        </Link>
      </td>
      <td className="px-3 py-2.5 text-[13px] font-medium text-[var(--text-high)]">
        {oc.fornecedor_nome}
      </td>
      <td className="px-3 py-2.5">
        <span className={cn(
          'px-2 py-0.5 rounded-full text-[11px] font-semibold',
          STATUS_STYLE[oc.status],
        )}>
          {STATUS_LABEL[oc.status]}
        </span>
      </td>
      <td className="px-3 py-2.5 font-mono text-[13px] font-semibold text-[var(--text-high)]">
        {fmtVal(oc.valor_total)}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--text-faint)]">
        {fmtData(oc.prazo_entrega)}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-center text-[var(--text-low)]">
        {oc.total_itens ?? 0}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--text-faint)]">
        {oc.condicao_pgto ?? '—'}
      </td>
    </tr>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function OcListPage() {
  const { obraId } = useParams<{ obraId: string }>()
  const id = Number(obraId)

  const [activeTab, setActiveTab] = useState('')
  const [busca, setBusca]         = useState('')

  const { data: ocs = [], isLoading } = useOcs(id, {
    status: activeTab || undefined,
  })

  const filtered = busca
    ? ocs.filter((o) =>
        o.numero.toLowerCase().includes(busca.toLowerCase()) ||
        o.fornecedor_nome.toLowerCase().includes(busca.toLowerCase()),
      )
    : ocs

  const abertas = ocs.filter((o) =>
    o.status === 'emitida' || o.status === 'parcialmente_recebida',
  ).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)]">Ordens de Compra</h1>
          {abertas > 0 && (
            <p className="text-[13px] text-[var(--warn)] mt-0.5">
              {abertas} OC{abertas > 1 ? 's' : ''} em aberto
            </p>
          )}
        </div>
        <Link
          to={`/almoxarifado/ocs/nova`}
          className={cn(
            'flex items-center gap-1.5 px-3 h-9 rounded-sm',
            'bg-[var(--accent)] text-white text-[13px] font-semibold',
            'hover:bg-[var(--accent-hover)] transition-colors',
          )}
        >
          <Plus size={13} /> Nova OC
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-dim)] mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-4 py-2 text-[13px] font-medium border-b-2 transition-colors',
              activeTab === tab.value
                ? 'text-[var(--accent)] border-[var(--accent)]'
                : 'text-[var(--text-low)] border-transparent hover:text-[var(--text-high)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          className={cn(
            'w-full max-w-[320px] h-8 px-3',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[13px] text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none',
            'focus:border-[var(--accent)]',
          )}
          placeholder="Buscar por número ou fornecedor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                {['Número', 'Fornecedor', 'Status', 'Valor Total', 'Prazo Entrega', 'Itens', 'Condição Pgto'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="skeleton h-4 rounded" style={{ width: j === 1 ? '140px' : '80px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Package size={28} className="mx-auto mb-2 text-[var(--text-faint)]" />
                    <p className="text-[13px] text-[var(--text-faint)]">
                      {busca ? 'Nenhuma OC encontrada.' : 'Nenhuma Ordem de Compra ainda.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((o) => <OcRow key={o.id} oc={o} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
