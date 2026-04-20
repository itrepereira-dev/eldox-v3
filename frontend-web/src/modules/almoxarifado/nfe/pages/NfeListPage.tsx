// frontend-web/src/modules/almoxarifado/nfe/pages/NfeListPage.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNfes } from '../hooks/useNfe'
import type { AlmNotaFiscal, AlmNfeStatus } from '../../_service/almoxarifado.service'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AlmNfeStatus, string> = {
  pendente_match: 'Aguard. Match',
  match_parcial:  'Match Parcial',
  match_ok:       'Match OK',
  aceita:         'Aceita',
  rejeitada:      'Rejeitada',
  sem_oc:         'Sem OC',
}

const STATUS_STYLE: Record<AlmNfeStatus, string> = {
  pendente_match: 'bg-[var(--warn-bg)] text-[var(--warn)]',
  match_parcial:  'bg-[var(--run-bg)] text-[var(--run)]',
  match_ok:       'bg-[var(--ok-bg)] text-[var(--ok)]',
  aceita:         'bg-[var(--ok-bg)] text-[var(--ok)]',
  rejeitada:      'bg-[var(--nc-bg)] text-[var(--nc)]',
  sem_oc:         'bg-[var(--off-bg)] text-[var(--off)]',
}

const TABS = [
  { label: 'Todas',             value: '' },
  { label: 'Aguard. Match',     value: 'pendente_match' },
  { label: 'Match Parcial',     value: 'match_parcial' },
  { label: 'Aceitas',           value: 'aceita' },
  { label: 'Rejeitadas',        value: 'rejeitada' },
]

// ── Row ────────────────────────────────────────────────────────────────────────

function NfeRow({ nfe }: { nfe: AlmNotaFiscal }) {
  function fmtData(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR')
  }
  function fmtVal(val: number | null) {
    if (val == null) return '—'
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  function fmtCnpj(cnpj: string | null) {
    if (!cnpj) return '—'
    const d = cnpj.replace(/\D/g, '')
    return d.length === 14
      ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : cnpj
  }

  return (
    <tr className="hover:bg-[var(--bg-raised)] transition-colors">
      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-faint)]">
        {fmtData(nfe.data_emissao)}
      </td>
      <td className="px-3 py-2.5">
        <Link
          to={`/almoxarifado/nfes/${nfe.id}`}
          className="text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          NF {nfe.numero ?? '—'}/{nfe.serie ?? '—'}
        </Link>
        <p className="text-[11px] text-[var(--text-faint)] font-mono mt-0.5">
          {nfe.chave_nfe.slice(0, 22)}…
        </p>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-[13px] text-[var(--text-high)]">{nfe.emitente_nome ?? '—'}</p>
        <p className="text-[11px] text-[var(--text-faint)] font-mono">{fmtCnpj(nfe.emitente_cnpj)}</p>
      </td>
      <td className="px-3 py-2.5 font-mono text-[13px] font-semibold text-[var(--text-high)]">
        {fmtVal(nfe.valor_total)}
      </td>
      <td className="px-3 py-2.5">
        <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', STATUS_STYLE[nfe.status])}>
          {STATUS_LABEL[nfe.status]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[12px] text-center text-[var(--text-low)]">
        {nfe.total_itens ?? 0}
      </td>
      <td className="px-3 py-2.5">
        {nfe.oc_numero ? (
          <span className="font-mono text-[12px] text-[var(--run)]">{nfe.oc_numero}</span>
        ) : (
          <span className="text-[11px] text-[var(--text-faint)]">—</span>
        )}
      </td>
    </tr>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function NfeListPage() {
  const [activeTab, setActiveTab] = useState('')
  const [busca, setBusca]         = useState('')

  const { data: nfes = [], isLoading } = useNfes(undefined, {
    status: activeTab || undefined,
  })

  const filtered = busca
    ? nfes.filter((n) =>
        (n.numero ?? '').includes(busca) ||
        (n.emitente_nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (n.chave_nfe ?? '').includes(busca),
      )
    : nfes

  const pendentes = nfes.filter(
    (n) => n.status === 'pendente_match' || n.status === 'match_parcial',
  ).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)]">Notas Fiscais Recebidas</h1>
          {pendentes > 0 && (
            <p className="text-[13px] mt-0.5 flex items-center gap-1.5 text-[var(--warn)]">
              <Zap size={12} />
              {pendentes} aguardando match / revisão
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/almoxarifado/nfes/upload"
            className={cn(
              'flex items-center gap-1.5 px-3 h-9 rounded-sm text-[13px] font-semibold',
              'bg-[var(--accent)] text-white hover:opacity-90 transition-opacity',
            )}
          >
            <FileText size={13} /> Upload XML
          </Link>
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-faint)]',
          )}>
            <FileText size={11} />
            Webhook: <code className="font-mono ml-1">POST /api/v1/almoxarifado/webhooks/nfe</code>
          </div>
        </div>
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
            'w-full max-w-[360px] h-8 px-3',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[13px] text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none',
            'focus:border-[var(--accent)]',
          )}
          placeholder="Buscar por número, emitente ou chave..."
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
                {['Emissão', 'Nota Fiscal', 'Emitente', 'Valor', 'Status', 'Itens', 'OC Vinculada'].map((h) => (
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
                        <div className="skeleton h-4 rounded" style={{ width: j === 2 ? '140px' : '80px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <FileText size={28} className="mx-auto mb-2 text-[var(--text-faint)]" />
                    <p className="text-[13px] text-[var(--text-faint)]">
                      {busca ? 'Nenhuma NF-e encontrada.' : 'Nenhuma NF-e recebida ainda.'}
                    </p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-1">
                      As notas chegam automaticamente via webhook quando emitidas pelo fornecedor.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((n) => <NfeRow key={n.id} nfe={n} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
