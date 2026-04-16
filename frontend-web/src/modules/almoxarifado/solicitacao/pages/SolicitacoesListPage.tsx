// frontend-web/src/modules/almoxarifado/solicitacao/pages/SolicitacoesListPage.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSolicitacoes } from '../hooks/useSolicitacao'
import type { AlmSolicitacao, AlmSolicitacaoStatus } from '../../_service/almoxarifado.service'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AlmSolicitacaoStatus, string> = {
  rascunho:              'Rascunho',
  aguardando_aprovacao:  'Aguardando',
  em_aprovacao:          'Em Aprovação',
  aprovada:              'Aprovada',
  reprovada:             'Reprovada',
  cancelada:             'Cancelada',
}

const STATUS_STYLE: Record<AlmSolicitacaoStatus, string> = {
  rascunho:             'bg-[var(--off-bg)] text-[var(--off)]',
  aguardando_aprovacao: 'bg-[var(--warn-bg)] text-[var(--warn)]',
  em_aprovacao:         'bg-[var(--run-bg)] text-[var(--run)]',
  aprovada:             'bg-[var(--ok-bg)] text-[var(--ok)]',
  reprovada:            'bg-[var(--nc-bg)] text-[var(--nc)]',
  cancelada:            'bg-[var(--off-bg)] text-[var(--off)]',
}

const TABS: Array<{ label: string; value: string }> = [
  { label: 'Todas',      value: '' },
  { label: 'Pendentes',  value: 'aguardando_aprovacao' },
  { label: 'Em Aprovação', value: 'em_aprovacao' },
  { label: 'Aprovadas',  value: 'aprovada' },
  { label: 'Rascunhos',  value: 'rascunho' },
]

// ── Row ────────────────────────────────────────────────────────────────────────

function SolicitacaoRow({ sol, obraId }: { sol: AlmSolicitacao; obraId: string }) {
  function fmtData(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  return (
    <tr className="hover:bg-[var(--bg-raised)] transition-colors">
      <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-faint)]">
        #{String(sol.numero).padStart(4, '0')}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          {sol.urgente && (
            <AlertTriangle size={12} className="text-[var(--warn)] flex-shrink-0" />
          )}
          <Link
            to={`/obras/${obraId}/almoxarifado/solicitacoes/${sol.id}`}
            className="text-[13px] font-medium text-[var(--accent)] hover:underline"
          >
            {sol.descricao}
          </Link>
        </div>
        {sol.servico_ref && (
          <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{sol.servico_ref}</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={cn(
          'px-2 py-0.5 rounded-full text-[11px] font-semibold',
          STATUS_STYLE[sol.status],
        )}>
          {STATUS_LABEL[sol.status]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--text-low)] text-center">
        {sol.total_itens ?? 0}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--text-faint)]">
        {sol.data_necessidade ? (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {fmtData(sol.data_necessidade)}
          </span>
        ) : '—'}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--text-low)]">
        {sol.solicitante_nome ?? '—'}
      </td>
      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-faint)]">
        {fmtData(sol.created_at)}
      </td>
    </tr>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function SolicitacoesListPage() {
  const { obraId } = useParams<{ obraId: string }>()
  const id = Number(obraId)

  const [activeTab, setActiveTab] = useState('')
  const [busca, setBusca]         = useState('')

  const { data: solicitacoes = [], isLoading } = useSolicitacoes(id, {
    status: activeTab || undefined,
  })

  const filtered = busca
    ? solicitacoes.filter((s) =>
        s.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        (s.servico_ref ?? '').toLowerCase().includes(busca.toLowerCase()),
      )
    : solicitacoes

  const pendentes = solicitacoes.filter(
    (s) => s.status === 'aguardando_aprovacao' || s.status === 'em_aprovacao',
  ).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)]">Solicitações de Compra</h1>
          {pendentes > 0 && (
            <p className="text-[13px] text-[var(--warn)] mt-0.5">
              {pendentes} aguardando aprovação
            </p>
          )}
        </div>
        <Link
          to={`/obras/${obraId}/almoxarifado/solicitacoes/nova`}
          className={cn(
            'flex items-center gap-1.5 px-3 h-9 rounded-sm',
            'bg-[var(--accent)] text-white text-[13px] font-semibold',
            'hover:bg-[var(--accent-hover)] transition-colors',
          )}
        >
          <Plus size={13} /> Nova Solicitação
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
          placeholder="Buscar por descrição ou serviço..."
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
                {['Nº', 'Descrição', 'Status', 'Itens', 'Necessidade', 'Solicitante', 'Criada'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="skeleton h-4 rounded" style={{ width: j === 1 ? '180px' : '70px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[13px] text-[var(--text-faint)]">
                    {busca ? 'Nenhuma solicitação encontrada.' : 'Nenhuma solicitação ainda.'}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <SolicitacaoRow key={s.id} sol={s} obraId={obraId!} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
