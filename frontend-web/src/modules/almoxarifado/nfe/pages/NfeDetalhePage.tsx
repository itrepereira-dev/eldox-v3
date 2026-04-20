// frontend-web/src/modules/almoxarifado/nfe/pages/NfeDetalhePage.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, CheckCircle, XCircle, Link2, Zap, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNfe, useAceitarNfe, useRejeitarNfe, useVincularOcNfe, useConfirmarMatchItem } from '../hooks/useNfe'
import { useLocais } from '../../locais/hooks/useLocais'
import type { AlmNfeItem, AlmMatchStatus } from '../../_service/almoxarifado.service'

// ── Match badge ────────────────────────────────────────────────────────────────

const MATCH_LABEL: Record<AlmMatchStatus, string> = {
  auto:              'Auto',
  pendente:          'Pendente',
  sem_match:         'Sem match',
  confirmado_manual: 'Confirmado',
}

const MATCH_STYLE: Record<AlmMatchStatus, string> = {
  auto:              'bg-[var(--ok-bg)] text-[var(--ok)]',
  pendente:          'bg-[var(--warn-bg)] text-[var(--warn)]',
  sem_match:         'bg-[var(--nc-bg)] text-[var(--nc)]',
  confirmado_manual: 'bg-[var(--run-bg)] text-[var(--run)]',
}

// ── Item row com sugestões IA ──────────────────────────────────────────────────

function NfeItemRow({
  item,
  nfeId: _nfeId,
  onConfirmar,
}: {
  item: AlmNfeItem
  nfeId: number
  onConfirmar: (itemId: number, catalogoId: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sugestoes = item.ai_sugestoes ?? []

  return (
    <>
      <tr
        className={cn(
          'hover:bg-[var(--bg-raised)] transition-colors cursor-pointer',
          expanded && 'bg-[var(--bg-raised)]',
        )}
        onClick={() => sugestoes.length > 0 && setExpanded((v) => !v)}
      >
        <td className="px-3 py-2.5 text-[13px] font-medium text-[var(--text-high)]">
          <div className="flex items-center gap-2">
            {sugestoes.length > 0 && (
              <ChevronRight
                size={12}
                className={cn(
                  'text-[var(--text-faint)] transition-transform flex-shrink-0',
                  expanded && 'rotate-90',
                )}
              />
            )}
            {item.xprod}
          </div>
        </td>
        <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-faint)]">
          {item.ncm ?? '—'}
        </td>
        <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-low)]">
          {item.cfop ?? '—'}
        </td>
        <td className="px-3 py-2.5 font-mono text-[13px] text-[var(--text-high)]">
          {item.quantidade != null
            ? Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
            : '—'}{' '}
          <span className="text-[11px] text-[var(--text-faint)]">{item.unidade_nfe}</span>
        </td>
        <td className="px-3 py-2.5 font-mono text-[12px] text-[var(--text-low)]">
          {item.valor_unitario != null
            ? Number(item.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '—'}
        </td>
        <td className="px-3 py-2.5">
          {item.catalogo_nome ? (
            <span className="text-[12px] text-[var(--text-high)]">{item.catalogo_nome}</span>
          ) : (
            <span className="text-[11px] text-[var(--text-faint)] italic">não vinculado</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-semibold',
              MATCH_STYLE[item.match_status],
            )}>
              {MATCH_LABEL[item.match_status]}
            </span>
            {item.ai_score != null && (
              <span className="text-[11px] font-mono text-[var(--text-faint)]">
                {Math.round(item.ai_score * 100)}%
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Sugestões IA expandidas */}
      {expanded && sugestoes.length > 0 && (
        <tr>
          <td colSpan={7} className="px-8 pb-3 bg-[var(--bg-raised)]">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)] mb-2">
              <Zap size={10} className="text-[var(--accent)]" />
              Sugestões da IA — clique para confirmar
            </div>
            <div className="flex flex-wrap gap-2">
              {sugestoes.map((s) => (
                <button
                  key={s.catalogo_id}
                  onClick={() => onConfirmar(item.id, s.catalogo_id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-sm text-[12px]',
                    'bg-[var(--bg-surface)] border border-[var(--border-dim)]',
                    'hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors',
                  )}
                >
                  <span className={cn(
                    'w-8 text-center font-mono font-bold text-[11px]',
                    s.score >= 0.7 ? 'text-[var(--ok)]' : 'text-[var(--warn)]',
                  )}>
                    {Math.round(s.score * 100)}%
                  </span>
                  <span className="text-[var(--text-high)]">{s.nome}</span>
                  <span className="text-[var(--text-faint)] text-[10px]">{s.motivo}</span>
                </button>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Vincular OC modal ─────────────────────────────────────────────────────────

function VincularOcModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void
  onConfirm: (ocId: number) => void
  loading: boolean
}) {
  const [ocId, setOcId] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-6 w-[380px] shadow-xl">
        <h3 className="text-[15px] font-semibold text-[var(--text-high)] mb-1">Vincular Ordem de Compra</h3>
        <p className="text-[12px] text-[var(--text-low)] mb-4">
          Informe o ID da OC correspondente a esta NF-e.
        </p>
        <input
          type="number"
          className={cn(
            'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[13px] font-mono text-[var(--text-high)] outline-none focus:border-[var(--accent)] mb-4',
          )}
          placeholder="ID da OC (ex: 12)"
          value={ocId}
          onChange={(e) => setOcId(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 h-8 text-[13px] rounded-sm border border-[var(--border-dim)] text-[var(--text-low)] hover:text-[var(--text-high)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => ocId && onConfirm(Number(ocId))}
            disabled={!ocId || loading}
            className="px-4 h-8 text-[13px] font-semibold rounded-sm bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : 'Vincular'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rejeitar modal ────────────────────────────────────────────────────────────

function RejeitarModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void
  onConfirm: (motivo: string) => void
  loading: boolean
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-6 w-[420px] shadow-xl">
        <h3 className="text-[15px] font-semibold text-[var(--text-high)] mb-3">Rejeitar NF-e</h3>
        <textarea
          className={cn(
            'w-full h-20 p-3 resize-none rounded-sm mb-4',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)]',
            'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--nc)]',
          )}
          placeholder="Motivo da rejeição..."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 h-8 text-[13px] rounded-sm border border-[var(--border-dim)] text-[var(--text-low)] hover:text-[var(--text-high)] transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => motivo.trim() && onConfirm(motivo.trim())}
            disabled={!motivo.trim() || loading}
            className="px-4 h-8 text-[13px] font-semibold rounded-sm bg-[var(--nc)] text-white hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : 'Rejeitar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function NfeDetalhePage() {
  const { nfeId } = useParams<{ nfeId: string }>()
  const nId = Number(nfeId)

  const [showVincular,  setShowVincular]  = useState(false)
  const [showRejeitar,  setShowRejeitar]  = useState(false)
  const [showAceitar,   setShowAceitar]   = useState(false)
  const [localAceitarId, setLocalAceitarId] = useState<number | ''>('')

  const { data: nfe, isLoading } = useNfe(nId)
  const { data: locais = [] }    = useLocais({ ativo: true })
  const aceitar         = useAceitarNfe(undefined, nId)
  const rejeitar        = useRejeitarNfe(undefined, nId)
  const vincularOc      = useVincularOcNfe(nId)
  const confirmarMatch  = useConfirmarMatchItem(nId)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-6 w-48 rounded" />
        <div className="skeleton h-32 rounded-md" />
        <div className="skeleton h-64 rounded-md" />
      </div>
    )
  }

  if (!nfe) return null

  const canAcao   = nfe.status !== 'aceita' && nfe.status !== 'rejeitada'
  const isFinal   = nfe.status === 'aceita' || nfe.status === 'rejeitada'
  const itens     = nfe.itens ?? []
  const pendentes = itens.filter((i) => i.match_status === 'pendente' || i.match_status === 'sem_match').length

  function fmtVal(val: number | null) {
    if (val == null) return '—'
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="p-6 max-w-[1000px]">
      {showAceitar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-5 w-[360px] shadow-xl">
            <p className="text-[14px] font-semibold text-[var(--text-high)] mb-3">Aceitar NF-e</p>
            <p className="text-[12px] text-[var(--text-low)] mb-4">Selecione o local de destino para entrada dos materiais.</p>
            <select
              value={localAceitarId}
              onChange={(e) => setLocalAceitarId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[13px] text-[var(--text-high)] outline-none mb-4"
            >
              <option value="">Selecionar local...</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>{l.nome} ({l.tipo})</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowAceitar(false); setLocalAceitarId('') }}
                className="px-3 h-8 text-[12px] border border-[var(--border-dim)] rounded-sm text-[var(--text-low)] hover:text-[var(--text-high)]"
              >
                Cancelar
              </button>
              <button
                disabled={!localAceitarId || aceitar.isPending}
                onClick={() => {
                  if (!localAceitarId) return
                  aceitar.mutate(
                    { local_id: localAceitarId as number },
                    { onSuccess: () => { setShowAceitar(false); setLocalAceitarId('') } },
                  )
                }}
                className="px-3 h-8 text-[12px] font-semibold bg-[var(--ok)] text-white rounded-sm hover:opacity-90 disabled:opacity-50"
              >
                Confirmar aceite
              </button>
            </div>
          </div>
        </div>
      )}
      {showVincular && (
        <VincularOcModal
          onClose={() => setShowVincular(false)}
          onConfirm={(ocId) => vincularOc.mutate(ocId, { onSuccess: () => setShowVincular(false) })}
          loading={vincularOc.isPending}
        />
      )}
      {showRejeitar && (
        <RejeitarModal
          onClose={() => setShowRejeitar(false)}
          onConfirm={(motivo) => rejeitar.mutate(motivo, { onSuccess: () => setShowRejeitar(false) })}
          loading={rejeitar.isPending}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-5 text-[12px]">
        <Link to={`/almoxarifado/nfes`} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
          Notas Fiscais
        </Link>
        <ChevronRight size={11} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-high)] font-medium font-mono">
          NF {nfe.numero}/{nfe.serie}
        </span>
      </div>

      {/* Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[18px] font-bold text-[var(--text-high)]">
              {nfe.emitente_nome ?? 'Emitente desconhecido'}
            </p>
            <p className="text-[12px] text-[var(--text-faint)] font-mono mt-0.5">{nfe.emitente_cnpj ?? '—'}</p>

            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[12px] text-[var(--text-low)]">
              <span>NF {nfe.numero}/{nfe.serie}</span>
              {nfe.data_emissao && (
                <span>Emissão: {new Date(nfe.data_emissao).toLocaleDateString('pt-BR')}</span>
              )}
              {nfe.valor_total && (
                <span className="font-semibold text-[var(--text-high)]">{fmtVal(nfe.valor_total)}</span>
              )}
              {nfe.oc_numero && (
                <span className="flex items-center gap-1 text-[var(--run)]">
                  <Link2 size={11} /> OC {nfe.oc_numero}
                </span>
              )}
            </div>

            {pendentes > 0 && (
              <div className="flex items-center gap-1.5 mt-3 text-[12px] text-[var(--warn)]">
                <AlertTriangle size={12} />
                {pendentes} item{pendentes > 1 ? 'ns' : ''} aguardando revisão de match
              </div>
            )}
          </div>

          {!isFinal && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setShowVincular(true)}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-sm',
                  'border border-[var(--border-dim)] text-[var(--text-low)]',
                  'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
                )}
              >
                <Link2 size={12} /> Vincular OC
              </button>
              {canAcao && (
                <>
                  <button
                    onClick={() => setShowRejeitar(true)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-sm',
                      'border border-[var(--nc)] text-[var(--nc)] hover:bg-[var(--nc-bg)] transition-colors',
                    )}
                  >
                    <XCircle size={12} /> Rejeitar
                  </button>
                  <button
                    onClick={() => setShowAceitar(true)}
                    disabled={aceitar.isPending}
                    className={cn(
                      'flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-sm',
                      'bg-[var(--ok)] text-white hover:opacity-90 transition-colors disabled:opacity-50',
                    )}
                  >
                    <CheckCircle size={12} /> Aceitar NF-e
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Chave */}
        <div className="mt-3 pt-3 border-t border-[var(--border-dim)]">
          <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mb-1">Chave de Acesso</p>
          <p className="font-mono text-[11px] text-[var(--text-low)] break-all">{nfe.chave_nfe}</p>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-dim)] flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)]">
            Itens ({itens.length})
          </h2>
          {pendentes > 0 && (
            <span className="text-[11px] font-medium text-[var(--warn)]">
              — expanda os itens pendentes para ver sugestões da IA
            </span>
          )}
        </div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-dim)]">
              {['Descrição NF-e', 'NCM', 'CFOP', 'Quantidade', 'Valor Unit.', 'Catálogo Match', 'Status IA'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-dim)]">
            {itens.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[13px] text-[var(--text-faint)]">
                  Nenhum item.
                </td>
              </tr>
            ) : (
              itens.map((item) => (
                <NfeItemRow
                  key={item.id}
                  item={item}
                  nfeId={nId}
                  onConfirmar={(itemId, catalogoId) =>
                    confirmarMatch.mutate({ itemId, catalogo_id: catalogoId })
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
