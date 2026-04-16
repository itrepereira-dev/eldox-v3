// frontend-web/src/modules/almoxarifado/planejamento/pages/PlanejamentoPage.tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  usePlanejamento,
  useUpsertPlanejamento,
  useRemoverPlanejamentoItem,
} from '../hooks/usePlanejamento'
import type { AlmPlanejamentoItem } from '../../_service/almoxarifado.service'

// ── Helpers ────────────────────────────────────────────────────────────────────

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function fmtQty(n: number) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

// ── Row ────────────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onRemover,
  onEditar,
}: {
  item: AlmPlanejamentoItem
  onRemover: (id: number) => void
  onEditar:  (item: AlmPlanejamentoItem) => void
}) {
  const realizado     = Number(item.consumo_realizado)
  const planejado     = Number(item.quantidade)
  const pct           = planejado > 0 ? Math.min((realizado / planejado) * 100, 150) : 0
  const excedeu       = realizado > planejado
  const barColor      = excedeu ? 'bg-[var(--nc)]' : pct >= 80 ? 'bg-[var(--warn)]' : 'bg-[var(--ok)]'

  return (
    <tr className="hover:bg-[var(--bg-raised)] transition-colors group">
      <td className="px-3 py-2.5">
        <p className="text-[13px] font-medium text-[var(--text-high)]">{item.catalogo_nome}</p>
        {item.catalogo_codigo && (
          <p className="text-[11px] text-[var(--text-faint)] font-mono">{item.catalogo_codigo}</p>
        )}
      </td>
      <td className="px-3 py-2.5 font-mono text-[13px] text-[var(--text-high)] text-right">
        {fmtQty(planejado)} <span className="text-[11px] text-[var(--text-faint)]">{item.unidade}</span>
      </td>
      <td className="px-3 py-2.5 font-mono text-[13px] text-right">
        <span className={cn(excedeu ? 'text-[var(--nc)]' : 'text-[var(--text-high)]')}>
          {fmtQty(realizado)}
        </span>
        <span className="text-[11px] text-[var(--text-faint)] ml-1">{item.unidade}</span>
      </td>
      <td className="px-3 py-2.5 w-[140px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[var(--border-dim)] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className={cn('text-[11px] font-mono w-[36px] text-right', excedeu ? 'text-[var(--nc)] font-semibold' : 'text-[var(--text-low)]')}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        {excedeu
          ? <TrendingUp size={14} className="text-[var(--nc)] mx-auto" />
          : realizado < planejado * 0.5
          ? <TrendingDown size={14} className="text-[var(--text-faint)] mx-auto" />
          : null}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEditar(item)}
            className="px-2 py-1 text-[11px] text-[var(--accent)] hover:bg-[var(--accent-dim)] rounded"
          >
            Editar
          </button>
          <button
            onClick={() => onRemover(item.id)}
            className="p-1 text-[var(--text-faint)] hover:text-[var(--nc)] rounded"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Modal de item ──────────────────────────────────────────────────────────────

function ItemModal({
  mes, ano, obraId,
  item,
  onClose,
}: {
  mes: number; ano: number; obraId: string
  item?: AlmPlanejamentoItem | null
  onClose: () => void
}) {
  const [catalogoId, setCatalogoId] = useState(item?.catalogo_id ?? 0)
  const [quantidade, setQuantidade] = useState(item?.quantidade ? String(item.quantidade) : '')
  const [observacao, setObservacao] = useState(item?.observacao ?? '')

  const upsert = useUpsertPlanejamento(Number(obraId), mes, ano)

  async function handleSave() {
    if (!catalogoId || !quantidade) return
    await upsert.mutateAsync({
      catalogo_id: catalogoId,
      mes, ano,
      quantidade:  Number(quantidade),
      observacao:  observacao || undefined,
    })
    onClose()
  }

  const inputCls = cn(
    'w-full h-8 px-3',
    'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
    'text-[13px] text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none',
    'focus:border-[var(--accent)]',
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg p-5 w-[380px] shadow-xl">
        <h3 className="text-[15px] font-semibold text-[var(--text-high)] mb-4">
          {item ? 'Editar item' : 'Adicionar item'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-1">
              ID do Material (catálogo)
            </label>
            <input
              className={inputCls}
              type="number"
              placeholder="Ex: 42"
              value={catalogoId || ''}
              onChange={(e) => setCatalogoId(Number(e.target.value))}
              disabled={!!item}
            />
            {item && (
              <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{item.catalogo_nome}</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-1">
              Quantidade planejada
            </label>
            <input
              className={inputCls}
              type="number"
              placeholder="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-1">
              Observação <span className="normal-case font-normal">(opcional)</span>
            </label>
            <input
              className={inputCls}
              placeholder="Ex: para fase de estrutura"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[13px] text-[var(--text-low)] hover:text-[var(--text-high)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!catalogoId || !quantidade || upsert.isPending}
            className={cn(
              'px-4 py-1.5 rounded text-[13px] font-medium',
              'bg-[var(--accent)] text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {upsert.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function PlanejamentoPage() {
  const { obraId } = useParams<{ obraId: string }>()
  const id = Number(obraId)

  const hoje   = new Date()
  const [mes,  setMes]  = useState(hoje.getMonth() + 1)
  const [ano,  setAno]  = useState(hoje.getFullYear())
  const [modal, setModal] = useState<false | 'novo' | AlmPlanejamentoItem>(false)

  const { data: itens = [], isLoading } = usePlanejamento(id, mes, ano)
  const remover = useRemoverPlanejamentoItem(id, mes, ano)

  const totalPlanejado  = itens.reduce((s, i) => s + Number(i.quantidade), 0)
  const totalRealizado  = itens.reduce((s, i) => s + Number(i.consumo_realizado), 0)
  const aderencia       = totalPlanejado > 0 ? (totalRealizado / totalPlanejado) * 100 : 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)] flex items-center gap-2">
            <CalendarDays size={18} /> Planejamento de Consumo
          </h1>
          <p className="text-[13px] text-[var(--text-low)] mt-0.5">
            Demanda prevista vs. consumo realizado por material
          </p>
        </div>

        <button
          onClick={() => setModal('novo')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Adicionar item
        </button>
      </div>

      {/* Seletor de período */}
      <div className="flex items-center gap-3 mb-5">
        <select
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="h-8 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
        >
          {MESES.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="h-8 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
        >
          {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* KPI resumo */}
        {itens.length > 0 && (
          <div className="ml-auto flex items-center gap-4 text-[12px]">
            <span className="text-[var(--text-low)]">
              {itens.length} material{itens.length !== 1 ? 'is' : ''}
            </span>
            <span className={cn(
              'px-2 py-0.5 rounded-full font-semibold',
              aderencia > 100 ? 'bg-[var(--nc-bg)] text-[var(--nc)]'
              : aderencia >= 80 ? 'bg-[var(--warn-bg)] text-[var(--warn)]'
              : 'bg-[var(--ok-bg)] text-[var(--ok)]',
            )}>
              Aderência {aderencia.toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                {['Material', 'Planejado', 'Realizado', 'Progresso', 'Tendência', ''].map((h) => (
                  <th key={h} className={cn(
                    'px-3 py-2 text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono',
                    h === 'Planejado' || h === 'Realizado' ? 'text-right' : 'text-left',
                  )}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="skeleton h-4 rounded" style={{ width: j === 0 ? '140px' : '80px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : itens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <CalendarDays size={28} className="mx-auto mb-2 text-[var(--text-faint)]" />
                    <p className="text-[13px] text-[var(--text-faint)]">
                      Nenhum item planejado para {MESES[mes - 1]} {ano}.
                    </p>
                    <button
                      onClick={() => setModal('novo')}
                      className="mt-2 text-[12px] text-[var(--accent)] hover:underline"
                    >
                      Adicionar primeiro item
                    </button>
                  </td>
                </tr>
              ) : (
                itens.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onRemover={(itemId) => remover.mutate(itemId)}
                    onEditar={(i) => setModal(i)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal !== false && (
        <ItemModal
          mes={mes}
          ano={ano}
          obraId={obraId!}
          item={modal === 'novo' ? null : modal}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}
