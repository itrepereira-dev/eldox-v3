// frontend-web/src/modules/almoxarifado/estoque/pages/EstoquePage.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, CheckCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSaldoEstoque, useLocaisEstoque } from '../hooks/useEstoque'
import type { AlmEstoqueSaldo } from '../../_service/almoxarifado.service'

// ── Nível Badge ───────────────────────────────────────────────────────────────

function NivelBadge({ nivel, quantidade, estoqueMin }: {
  nivel: string; quantidade: number; estoqueMin: number
}) {
  if (nivel === 'critico') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--nc-bg)] text-[var(--nc)]">
      <AlertOctagon size={9} /> Crítico
    </span>
  )
  if (nivel === 'atencao') return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--warn-bg)] text-[var(--warn)]">
        <AlertTriangle size={9} /> Atenção
      </span>
      {estoqueMin > 0 && (
        <div className="w-16 h-1 bg-[var(--border-dim)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--warn)] rounded-full"
            style={{ width: `${Math.min(100, (quantidade / estoqueMin) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--ok-bg)] text-[var(--ok)]">
        <CheckCircle size={9} /> Normal
      </span>
      <div className="w-16 h-1 bg-[var(--border-dim)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--ok)] rounded-full" style={{ width: '100%' }} />
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function SaldoRow({ saldo }: { saldo: AlmEstoqueSaldo }) {
  return (
    <tr className="hover:bg-[var(--bg-raised)] transition-colors">
      <td className="px-3 py-2.5 text-[13px] font-medium text-[var(--text-high)]">
        {saldo.catalogo_nome}
      </td>
      <td className="px-3 py-2.5 text-[11px] text-[var(--text-faint)] font-mono">
        {saldo.catalogo_codigo ?? '—'}
      </td>
      <td className="px-3 py-2.5 text-[13px] font-mono
        text-[var(--text-low)]">
        {saldo.unidade}
      </td>
      <td className={cn(
        'px-3 py-2.5 text-[13px] font-bold font-mono',
        saldo.nivel === 'critico' ? 'text-[var(--nc)]' :
        saldo.nivel === 'atencao' ? 'text-[var(--warn)]' : 'text-[var(--text-high)]',
      )}>
        {Number(saldo.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
      </td>
      <td className="px-3 py-2.5 text-[12px] font-mono text-[var(--text-faint)]">
        {saldo.estoque_min > 0
          ? Number(saldo.estoque_min).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
          : '—'}
      </td>
      <td className="px-3 py-2.5">
        <NivelBadge
          nivel={saldo.nivel}
          quantidade={saldo.quantidade}
          estoqueMin={saldo.estoque_min}
        />
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--text-faint)]">
        {saldo.local_nome ?? 'Geral'}
      </td>
      <td className="px-3 py-2.5">
        <button className={cn(
          'px-2.5 py-1 text-[11px] font-medium rounded-sm',
          'border border-[var(--border-dim)] text-[var(--text-low)]',
          'hover:text-[var(--text-high)] hover:border-[var(--border)]',
          'transition-colors',
        )}>
          Movimentar
        </button>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function EstoquePage() {
  const { obraId } = useParams<{ obraId: string }>()
  const id = Number(obraId)

  const [nivelFiltro, setNivelFiltro]   = useState('')
  const [busca, setBusca]               = useState('')

  const { data: saldos = [], isLoading } = useSaldoEstoque(id, {
    nivel: nivelFiltro || undefined,
  })
  const { data: locais = [] } = useLocaisEstoque(id)

  const filtered = busca
    ? saldos.filter((s) =>
        s.catalogo_nome.toLowerCase().includes(busca.toLowerCase()) ||
        (s.catalogo_codigo ?? '').toLowerCase().includes(busca.toLowerCase()),
      )
    : saldos

  const criticos = saldos.filter((s) => s.nivel === 'critico').length
  const atencao  = saldos.filter((s) => s.nivel === 'atencao').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)]">Estoque</h1>
          <p className="text-[13px] text-[var(--text-low)] mt-0.5">
            {saldos.length} itens cadastrados
            {criticos > 0 && (
              <span className="ml-2 text-[var(--nc)]">· {criticos} crítico{criticos > 1 ? 's' : ''}</span>
            )}
            {atencao > 0 && (
              <span className="ml-2 text-[var(--warn)]">· {atencao} atenção</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={cn(
            'flex items-center gap-1.5 px-3 h-9 rounded-sm text-[13px] font-medium',
            'border border-[var(--border-dim)] text-[var(--text-low)] bg-[var(--bg-raised)]',
            'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
          )}>
            Transferência
          </button>
          <button className={cn(
            'flex items-center gap-1.5 px-3 h-9 rounded-sm',
            'bg-[var(--accent)] text-white text-[13px] font-semibold',
            'hover:bg-[var(--accent-hover)] transition-colors',
          )}>
            <Plus size={13} /> Movimento Manual
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-dim)] mb-5">
        {[
          { label: 'Saldo Atual', to: '' },
          { label: 'Movimentos', to: `/obras/${obraId}/almoxarifado/estoque/movimentos` },
          { label: `Alertas${criticos + atencao > 0 ? ` (${criticos + atencao})` : ''}`,
            to: `/obras/${obraId}/almoxarifado/estoque/alertas` },
        ].map((tab) => (
          tab.to ? (
            <Link
              key={tab.label}
              to={tab.to}
              className="px-4 py-2 text-[13px] font-medium text-[var(--text-low)] border-b-2 border-transparent hover:text-[var(--text-high)] transition-colors"
            >
              {tab.label}
            </Link>
          ) : (
            <span
              key={tab.label}
              className="px-4 py-2 text-[13px] font-semibold text-[var(--accent)] border-b-2 border-[var(--accent)]"
            >
              {tab.label}
            </span>
          )
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className={cn(
            'flex-1 min-w-[200px] max-w-[280px] h-8 px-3',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[13px] text-[var(--text-high)] placeholder:text-[var(--text-faint)]',
            'outline-none focus:border-[var(--accent)]',
          )}
          placeholder="Buscar material..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className={cn(
            'h-8 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[12px] text-[var(--text-low)] outline-none',
          )}
          value={nivelFiltro}
          onChange={(e) => setNivelFiltro(e.target.value)}
        >
          <option value="">Todos os níveis</option>
          <option value="critico">Crítico</option>
          <option value="atencao">Atenção</option>
          <option value="normal">Normal</option>
        </select>
        <select
          className={cn(
            'h-8 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[12px] text-[var(--text-low)] outline-none',
          )}
        >
          <option>Todos os locais</option>
          {locais.map((l) => <option key={l.id}>{l.nome}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                {['Material', 'Código', 'Un.', 'Saldo', 'Est. Mínimo', 'Nível', 'Local', ''].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="skeleton h-4 rounded" style={{ width: j === 0 ? '140px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[13px] text-[var(--text-faint)]">
                    {busca ? 'Nenhum material encontrado para esta busca.' : 'Nenhum item em estoque ainda.'}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => <SaldoRow key={s.id} saldo={s} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
