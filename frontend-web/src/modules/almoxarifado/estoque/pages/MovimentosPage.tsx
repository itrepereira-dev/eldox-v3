// frontend-web/src/modules/almoxarifado/estoque/pages/MovimentosPage.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useMovimentos } from '../hooks/useEstoque'
import type { AlmMovimentoTipo } from '../../_service/almoxarifado.service'

const TIPO_LABEL: Record<AlmMovimentoTipo, string> = {
  entrada:       'Entrada',
  saida:         'Saída',
  transferencia: 'Transferência',
  perda:         'Perda',
  ajuste:        'Ajuste',
}

const TIPO_STYLE: Record<AlmMovimentoTipo, string> = {
  entrada:       'bg-[var(--ok-bg)] text-[var(--ok)]',
  saida:         'bg-[var(--nc-bg)] text-[var(--nc)]',
  transferencia: 'bg-[var(--run-bg)] text-[var(--run)]',
  perda:         'bg-[var(--warn-bg)] text-[var(--warn)]',
  ajuste:        'bg-[var(--off-bg)] text-[var(--off)]',
}

const DELTA_SIGN: Record<AlmMovimentoTipo, 1 | -1> = {
  entrada: 1, saida: -1, perda: -1, ajuste: 1, transferencia: -1,
}

export function MovimentosPage() {
  const { obraId } = useParams<{ obraId: string }>()
  const id = Number(obraId)

  const [tipoFiltro, setTipoFiltro] = useState('')
  const [busca, setBusca] = useState('')

  const { data: movimentos = [], isLoading } = useMovimentos(id, {
    tipo: tipoFiltro || undefined,
    limit: 100,
  })

  const filtered = busca
    ? movimentos.filter((m) =>
        m.catalogo_nome.toLowerCase().includes(busca.toLowerCase()),
      )
    : movimentos

  function fmtData(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <Link
          to={`/obras/${obraId}/almoxarifado/estoque`}
          className="text-[var(--text-faint)] hover:text-[var(--text-high)] text-[12px]"
        >
          ← Estoque
        </Link>
        <span className="text-[var(--text-faint)]">/</span>
        <h1 className="text-[18px] font-bold text-[var(--text-high)]">Movimentos</h1>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        <input
          className={cn(
            'flex-1 max-w-[260px] h-8 px-3',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[13px] text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none',
            'focus:border-[var(--accent)]',
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
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                {['Data/Hora', 'Material', 'Tipo', 'Qtd.', 'Un.', 'Saldo Ant.', 'Saldo Atual', 'Responsável', 'Referência'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="skeleton h-4 rounded" style={{ width: j === 1 ? '140px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[13px] text-[var(--text-faint)]">
                    Nenhum movimento encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const delta = DELTA_SIGN[m.tipo] * m.quantidade
                  return (
                    <tr key={m.id} className="hover:bg-[var(--bg-raised)] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-faint)] whitespace-nowrap">
                        {fmtData(m.created_at)}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-medium text-[var(--text-high)]">
                        {m.catalogo_nome}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', TIPO_STYLE[m.tipo])}>
                          {TIPO_LABEL[m.tipo]}
                        </span>
                      </td>
                      <td className={cn(
                        'px-3 py-2.5 font-mono text-[13px] font-bold',
                        delta > 0 ? 'text-[var(--ok)]' : 'text-[var(--nc)]',
                      )}>
                        {delta > 0 ? '+' : ''}{m.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-faint)]">{m.unidade}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-faint)]">
                        {m.saldo_anterior.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-high)] font-semibold">
                        {m.saldo_posterior.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[var(--text-low)]">
                        {m.usuario_nome ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--run)]">
                        {m.referencia_tipo && m.referencia_id
                          ? `${m.referencia_tipo.toUpperCase()} #${m.referencia_id}`
                          : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
