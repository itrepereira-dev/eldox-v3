// frontend-web/src/modules/almoxarifado/compras/pages/OcDetalhePage.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CheckCircle, XCircle, Send, ChevronRight,
  Package, Truck, Clock,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  useOc,
  useConfirmarOc, useEmitirOc,
  useReceberOcItens, useCancelarOc,
} from '../hooks/useCompras'
import type { AlmOcStatus, AlmOcItem, ReceberOcItemPayload } from '../../_service/almoxarifado.service'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AlmOcStatus, string> = {
  rascunho:               'Rascunho',
  confirmada:             'Confirmada',
  emitida:                'Emitida ao Fornecedor',
  parcialmente_recebida:  'Parcialmente Recebida',
  recebida:               'Recebida',
  cancelada:              'Cancelada',
}

const STATUS_STYLE: Record<AlmOcStatus, string> = {
  rascunho:               'bg-[var(--off-bg)] text-[var(--off)]',
  confirmada:             'bg-[var(--warn-bg)] text-[var(--warn)]',
  emitida:                'bg-[var(--run-bg)] text-[var(--run)]',
  parcialmente_recebida:  'bg-[var(--warn-bg)] text-[var(--warn)]',
  recebida:               'bg-[var(--ok-bg)] text-[var(--ok)]',
  cancelada:              'bg-[var(--off-bg)] text-[var(--off)]',
}

// ── Recebimento Modal ────────────────────────────────────────────────────────

function ReceberModal({
  itens,
  onClose,
  onConfirm,
  loading,
}: {
  itens: AlmOcItem[]
  onClose: () => void
  onConfirm: (receitas: ReceberOcItemPayload[]) => void
  loading: boolean
}) {
  const [qtds, setQtds] = useState<Record<number, string>>(() =>
    Object.fromEntries(itens.map((i) => [i.id, String(i.quantidade - i.qtd_recebida)])),
  )

  function handleConfirm() {
    const receitas: ReceberOcItemPayload[] = Object.entries(qtds)
      .map(([id, q]) => ({ item_id: Number(id), qtd_recebida: Number(q) }))
      .filter((r) => r.qtd_recebida > 0)
    onConfirm(receitas)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-6 w-[560px] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <Truck size={16} className="text-[var(--ok)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-high)]">Registrar Recebimento</h3>
        </div>
        <p className="text-[12px] text-[var(--text-low)] mb-4">
          Informe as quantidades efetivamente recebidas. O estoque será atualizado automaticamente.
        </p>

        <table className="w-full text-[13px] mb-5">
          <thead>
            <tr className="border-b border-[var(--border-dim)]">
              {['Material', 'Pendente', 'Qtd. Recebida'].map((h) => (
                <th key={h} className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-dim)]">
            {itens.map((item) => {
              const pendente = item.quantidade - item.qtd_recebida
              return (
                <tr key={item.id}>
                  <td className="py-2 pr-3">
                    <p className="text-[13px] font-medium text-[var(--text-high)]">{item.catalogo_nome}</p>
                    <p className="text-[11px] text-[var(--text-faint)] font-mono">{item.unidade}</p>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[12px] text-[var(--text-low)]">
                    {pendente.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="py-2 w-28">
                    <input
                      type="number"
                      min={0}
                      max={pendente}
                      step="any"
                      className={cn(
                        'w-full h-7 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                        'text-[13px] font-mono text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
                      )}
                      value={qtds[item.id] ?? ''}
                      onChange={(e) => setQtds((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className={cn(
              'px-4 h-8 text-[13px] rounded-sm',
              'border border-[var(--border-dim)] text-[var(--text-low)]',
              'hover:text-[var(--text-high)] transition-colors',
            )}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'px-4 h-8 text-[13px] font-semibold rounded-sm',
              'bg-[var(--ok)] text-white hover:opacity-90 transition-colors',
              'disabled:opacity-50',
            )}
          >
            {loading ? '...' : 'Confirmar Recebimento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Progress bar de itens ─────────────────────────────────────────────────────

function ItemProgress({ item }: { item: AlmOcItem }) {
  const pct   = item.quantidade > 0 ? (item.qtd_recebida / item.quantidade) * 100 : 0
  const full  = pct >= 100
  const partial = pct > 0 && pct < 100

  return (
    <tr className="hover:bg-[var(--bg-raised)] transition-colors">
      <td className="px-3 py-2.5">
        <p className="text-[13px] font-medium text-[var(--text-high)]">{item.catalogo_nome}</p>
        {item.catalogo_codigo && (
          <p className="text-[11px] text-[var(--text-faint)] font-mono">{item.catalogo_codigo}</p>
        )}
      </td>
      <td className="px-3 py-2.5 font-mono text-[13px] text-[var(--text-high)]">
        {Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
      </td>
      <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-faint)]">
        {item.unidade}
      </td>
      <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-low)]">
        {item.preco_unitario
          ? Number(item.preco_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '—'}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[var(--border-dim)] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                full ? 'bg-[var(--ok)]' : partial ? 'bg-[var(--warn)]' : 'bg-[var(--border)]',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={cn(
            'text-[11px] font-mono font-semibold min-w-[42px] text-right',
            full ? 'text-[var(--ok)]' : partial ? 'text-[var(--warn)]' : 'text-[var(--text-faint)]',
          )}>
            {Number(item.qtd_recebida).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          </span>
        </div>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function OcDetalhePage() {
  const { obraId, ocId } = useParams<{ obraId: string; ocId: string }>()
  const oId  = Number(obraId)
  const oId2 = Number(ocId)

  const [showReceber, setShowReceber] = useState(false)

  const { data: oc, isLoading }     = useOc(oId2)
  const confirmar  = useConfirmarOc(oId, oId2)
  const emitir     = useEmitirOc(oId, oId2)
  const receber    = useReceberOcItens(oId, oId2)
  const cancelar   = useCancelarOc(oId, oId2)

  async function handleReceber(receitas: ReceberOcItemPayload[]) {
    await receber.mutateAsync(receitas)
    setShowReceber(false)
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-6 w-32 rounded" />
        <div className="skeleton h-28 rounded-md" />
        <div className="skeleton h-48 rounded-md" />
      </div>
    )
  }

  if (!oc) return null

  const itensPendentes = (oc.itens ?? []).filter((i) => i.qtd_recebida < i.quantidade)
  const isFinal   = oc.status === 'recebida' || oc.status === 'cancelada'
  const canConfirmar = oc.status === 'rascunho'
  const canEmitir    = oc.status === 'confirmada'
  const canReceber   = oc.status === 'emitida' || oc.status === 'parcialmente_recebida'
  const canCancelar  = !isFinal

  return (
    <div className="p-6 max-w-[900px]">
      {showReceber && (
        <ReceberModal
          itens={itensPendentes}
          onClose={() => setShowReceber(false)}
          onConfirm={handleReceber}
          loading={receber.isPending}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-5 text-[12px]">
        <Link to={`/almoxarifado/ocs`} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
          Ordens de Compra
        </Link>
        <ChevronRight size={11} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-high)] font-medium font-mono">{oc.numero}</span>
      </div>

      {/* Header card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-semibold',
                STATUS_STYLE[oc.status],
              )}>
                {STATUS_LABEL[oc.status]}
              </span>
              <span className="font-mono text-[13px] font-bold text-[var(--text-high)]">{oc.numero}</span>
            </div>
            <p className="text-[18px] font-bold text-[var(--text-high)]">{oc.fornecedor_nome}</p>

            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[12px] text-[var(--text-low)]">
              {oc.valor_total && (
                <span className="font-semibold text-[var(--text-high)]">
                  {Number(oc.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              )}
              {oc.prazo_entrega && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(oc.prazo_entrega).toLocaleDateString('pt-BR')}
                </span>
              )}
              {oc.condicao_pgto && <span>{oc.condicao_pgto}</span>}
              {oc.local_entrega && (
                <span className="flex items-center gap-1">
                  <Package size={11} />
                  {oc.local_entrega}
                </span>
              )}
              {oc.criado_por_nome && <span>Criada por {oc.criado_por_nome}</span>}
            </div>
          </div>

          {/* Ações */}
          {!isFinal && (
            <div className="flex gap-2 flex-shrink-0">
              {canConfirmar && (
                <button
                  onClick={() => confirmar.mutate()}
                  disabled={confirmar.isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-sm',
                    'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors',
                    'disabled:opacity-50',
                  )}
                >
                  <CheckCircle size={12} /> Confirmar OC
                </button>
              )}
              {canEmitir && (
                <button
                  onClick={() => emitir.mutate()}
                  disabled={emitir.isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-sm',
                    'bg-[var(--run)] text-white hover:opacity-90 transition-colors',
                    'disabled:opacity-50',
                  )}
                >
                  <Send size={12} /> Emitir ao Fornecedor
                </button>
              )}
              {canReceber && itensPendentes.length > 0 && (
                <button
                  onClick={() => setShowReceber(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-sm',
                    'bg-[var(--ok)] text-white hover:opacity-90 transition-colors',
                  )}
                >
                  <Truck size={12} /> Registrar Recebimento
                </button>
              )}
              {canCancelar && (
                <button
                  onClick={() => cancelar.mutate()}
                  disabled={cancelar.isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-sm',
                    'border border-[var(--border-dim)] text-[var(--text-faint)]',
                    'hover:text-[var(--nc)] hover:border-[var(--nc)] transition-colors',
                    'disabled:opacity-50',
                  )}
                >
                  <XCircle size={12} /> Cancelar
                </button>
              )}
            </div>
          )}
        </div>

        {oc.observacoes && (
          <p className="mt-3 text-[12px] text-[var(--text-low)] italic border-t border-[var(--border-dim)] pt-3">
            {oc.observacoes}
          </p>
        )}
      </div>

      {/* Itens */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-dim)]">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)]">
            Itens ({oc.itens?.length ?? 0})
          </h2>
        </div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-dim)]">
              {['Material', 'Qtd. Pedida', 'Un.', 'Preço Unit.', 'Qtd. Recebida'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-dim)]">
            {(oc.itens ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[13px] text-[var(--text-faint)]">
                  Nenhum item nesta OC.
                </td>
              </tr>
            ) : (
              (oc.itens ?? []).map((item) => (
                <ItemProgress key={item.id} item={item} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
