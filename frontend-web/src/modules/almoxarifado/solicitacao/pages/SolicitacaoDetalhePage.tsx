// frontend-web/src/modules/almoxarifado/solicitacao/pages/SolicitacaoDetalhePage.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle, XCircle, Clock,
  ChevronRight, Send, Ban,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  useSolicitacao,
  useSubmeterSolicitacao,
  useAprovarSolicitacao,
  useCancelarSolicitacao,
} from '../hooks/useSolicitacao'
import type { AlmSolicitacaoStatus, AlmAprovacao } from '../../_service/almoxarifado.service'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AlmSolicitacaoStatus, string> = {
  rascunho:             'Rascunho',
  aguardando_aprovacao: 'Aguardando Aprovação',
  em_aprovacao:         'Em Aprovação',
  aprovada:             'Aprovada',
  reprovada:            'Reprovada',
  cancelada:            'Cancelada',
}

const STATUS_STYLE: Record<AlmSolicitacaoStatus, string> = {
  rascunho:             'bg-[var(--off-bg)] text-[var(--off)]',
  aguardando_aprovacao: 'bg-[var(--warn-bg)] text-[var(--warn)]',
  em_aprovacao:         'bg-[var(--run-bg)] text-[var(--run)]',
  aprovada:             'bg-[var(--ok-bg)] text-[var(--ok)]',
  reprovada:            'bg-[var(--nc-bg)] text-[var(--nc)]',
  cancelada:            'bg-[var(--off-bg)] text-[var(--off)]',
}

// ── Timeline item ──────────────────────────────────────────────────────────────

function TimelineItem({ aprov, isLast }: { aprov: AlmAprovacao; isLast: boolean }) {
  const isOk = aprov.acao === 'aprovado'
  const isNc = aprov.acao === 'reprovado' || aprov.acao === 'cancelado'

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
          isOk ? 'bg-[var(--ok-bg)] text-[var(--ok)]' :
          isNc ? 'bg-[var(--nc-bg)] text-[var(--nc)]' :
                  'bg-[var(--warn-bg)] text-[var(--warn)]',
        )}>
          {isOk ? <CheckCircle size={14} /> : isNc ? <XCircle size={14} /> : <Clock size={14} />}
        </div>
        {!isLast && <div className="w-px flex-1 bg-[var(--border-dim)] my-1" />}
      </div>
      <div className="pb-4 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--text-high)] capitalize">
            {aprov.acao}
          </span>
          <span className="text-[11px] text-[var(--text-faint)] font-mono">
            Etapa {aprov.etapa}
          </span>
        </div>
        <p className="text-[12px] text-[var(--text-low)]">
          {aprov.aprovador_nome ?? 'Sistema'}
          {' · '}
          {new Date(aprov.created_at).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
        {aprov.observacao && (
          <p className="mt-1 text-[12px] text-[var(--text-low)] italic bg-[var(--bg-raised)] px-2 py-1 rounded-sm border border-[var(--border-dim)]">
            "{aprov.observacao}"
          </p>
        )}
      </div>
    </div>
  )
}

// ── Aprovar Modal ─────────────────────────────────────────────────────────────

function AprovarModal({
  acao,
  onClose,
  onConfirm,
  loading,
}: {
  acao: 'aprovado' | 'reprovado'
  onClose: () => void
  onConfirm: (obs: string) => void
  loading: boolean
}) {
  const [obs, setObs] = useState('')
  const isNc = acao === 'reprovado'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-6 w-[420px] shadow-xl">
        <h3 className="text-[15px] font-semibold text-[var(--text-high)] mb-1">
          {isNc ? 'Reprovar Solicitação' : 'Aprovar Solicitação'}
        </h3>
        <p className="text-[12px] text-[var(--text-low)] mb-4">
          {isNc
            ? 'Descreva o motivo da reprovação (recomendado).'
            : 'Adicione uma observação opcional antes de aprovar.'}
        </p>
        <textarea
          className={cn(
            'w-full h-24 p-3 resize-none rounded-sm',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)]',
            'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
          )}
          placeholder={isNc ? 'Motivo da reprovação...' : 'Observação (opcional)...'}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
        <div className="flex gap-2 justify-end mt-4">
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
            onClick={() => onConfirm(obs)}
            disabled={loading}
            className={cn(
              'px-4 h-8 text-[13px] font-semibold rounded-sm',
              isNc
                ? 'bg-[var(--nc)] text-white hover:opacity-90'
                : 'bg-[var(--ok)] text-white hover:opacity-90',
              'disabled:opacity-50 transition-colors',
            )}
          >
            {loading ? '...' : isNc ? 'Reprovar' : 'Confirmar Aprovação'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SolicitacaoDetalhePage() {
  const { obraId, solicitacaoId } = useParams<{ obraId: string; solicitacaoId: string }>()
  const oId  = Number(obraId)
  const sId  = Number(solicitacaoId)

  const [modal, setModal] = useState<'aprovado' | 'reprovado' | null>(null)

  const { data: sol, isLoading } = useSolicitacao(sId)
  const submeter  = useSubmeterSolicitacao(oId)
  const aprovar   = useAprovarSolicitacao(oId, sId)
  const cancelar  = useCancelarSolicitacao(oId, sId)

  async function handleAprovar(obs: string) {
    if (!modal) return
    await aprovar.mutateAsync({ acao: modal, observacao: obs || undefined })
    setModal(null)
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-6 w-48 rounded" />
        <div className="skeleton h-32 rounded-md" />
        <div className="skeleton h-48 rounded-md" />
      </div>
    )
  }

  if (!sol) return null

  const canSubmeter  = sol.status === 'rascunho'
  const canAprovar   = sol.status === 'aguardando_aprovacao' || sol.status === 'em_aprovacao'
  const canCancelar  = sol.status !== 'aprovada' && sol.status !== 'cancelada'
  const isFinal      = sol.status === 'aprovada' || sol.status === 'reprovada' || sol.status === 'cancelada'

  return (
    <div className="p-6 max-w-[860px]">
      {modal && (
        <AprovarModal
          acao={modal}
          onClose={() => setModal(null)}
          onConfirm={handleAprovar}
          loading={aprovar.isPending}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-5 text-[12px]">
        <Link to={`/obras/${obraId}/almoxarifado/solicitacoes`} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
          Solicitações
        </Link>
        <ChevronRight size={11} className="text-[var(--text-faint)]" />
        <span className="text-[var(--text-high)] font-medium">
          #{String(sol.numero).padStart(4, '0')} {sol.descricao}
        </span>
      </div>

      {/* Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-semibold',
                STATUS_STYLE[sol.status],
              )}>
                {STATUS_LABEL[sol.status]}
              </span>
              {sol.urgente && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--warn-bg)] text-[var(--warn)]">
                  <AlertTriangle size={10} /> Urgente
                </span>
              )}
            </div>
            <h1 className="text-[18px] font-bold text-[var(--text-high)]">{sol.descricao}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-[12px] text-[var(--text-low)]">
              {sol.servico_ref && <span>Serviço: {sol.servico_ref}</span>}
              {sol.data_necessidade && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  Necessidade: {new Date(sol.data_necessidade).toLocaleDateString('pt-BR')}
                </span>
              )}
              <span>Solicitante: {sol.solicitante_nome ?? '—'}</span>
            </div>
          </div>

          {/* Ações */}
          {!isFinal && (
            <div className="flex gap-2 flex-shrink-0">
              {canSubmeter && (
                <button
                  onClick={() => submeter.mutate(sId)}
                  disabled={submeter.isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-sm',
                    'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors',
                    'disabled:opacity-50',
                  )}
                >
                  <Send size={12} />
                  Submeter
                </button>
              )}
              {canAprovar && (
                <>
                  <button
                    onClick={() => setModal('reprovado')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-sm',
                      'border border-[var(--nc)] text-[var(--nc)] hover:bg-[var(--nc-bg)] transition-colors',
                    )}
                  >
                    <XCircle size={12} />
                    Reprovar
                  </button>
                  <button
                    onClick={() => setModal('aprovado')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold rounded-sm',
                      'bg-[var(--ok)] text-white hover:opacity-90 transition-colors',
                    )}
                  >
                    <CheckCircle size={12} />
                    Aprovar
                  </button>
                </>
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
                  <Ban size={12} />
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-5">
        {/* Itens */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-dim)]">
            <h2 className="text-[13px] font-semibold text-[var(--text-high)]">
              Materiais ({sol.itens?.length ?? 0})
            </h2>
          </div>
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                {['Material', 'Qtd.', 'Un.', 'Obs.'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {(sol.itens ?? []).map((item) => (
                <tr key={item.id} className="hover:bg-[var(--bg-raised)] transition-colors">
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
                  <td className="px-3 py-2.5 text-[12px] text-[var(--text-low)]">
                    {item.observacao ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Timeline */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-4">
            Histórico de Aprovação
          </h2>
          {(sol.aprovacoes ?? []).length === 0 ? (
            <p className="text-[12px] text-[var(--text-faint)]">Nenhuma ação ainda.</p>
          ) : (
            (sol.aprovacoes ?? []).map((aprov, idx, arr) => (
              <TimelineItem
                key={aprov.id}
                aprov={aprov}
                isLast={idx === arr.length - 1}
              />
            ))
          )}

          {/* Status atual como pending se não finalizado */}
          {!isFinal && (
            <div className="flex gap-3 mt-2">
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-[var(--border-dim)] flex items-center justify-center flex-shrink-0">
                <Clock size={12} className="text-[var(--text-faint)]" />
              </div>
              <p className="text-[12px] text-[var(--text-faint)] pt-1">
                {STATUS_LABEL[sol.status]}...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
