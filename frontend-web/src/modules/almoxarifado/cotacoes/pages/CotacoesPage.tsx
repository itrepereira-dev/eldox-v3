// frontend-web/src/modules/almoxarifado/cotacoes/pages/CotacoesPage.tsx
// Painel de cotações de uma solicitação: lista fornecedores convidados,
// permite enviar links e navegar para o comparativo.
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Send, Link2, CheckCircle, Clock, XCircle, BarChart3,
  Plus, Trash2, AlertTriangle,
} from 'lucide-react'
import { almoxarifadoService } from '../../_service/almoxarifado.service'
import type { AlmCotacao, AlmCotacaoStatus } from '../../_service/almoxarifado.service'
import { cn } from '@/lib/cn'
import type { ReactElement } from 'react'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AlmCotacaoStatus, string> = {
  em_preenchimento: 'Aguardando envio',
  enviada:          'Enviada',
  respondida:       'Respondida',
  selecionada:      'Selecionada',
  cancelada:        'Cancelada',
}

const STATUS_ICON: Record<AlmCotacaoStatus, ReactElement> = {
  em_preenchimento: <Clock size={13} />,
  enviada:          <Send size={13} />,
  respondida:       <CheckCircle size={13} />,
  selecionada:      <CheckCircle size={13} />,
  cancelada:        <XCircle size={13} />,
}

const STATUS_COLOR: Record<AlmCotacaoStatus, string> = {
  em_preenchimento: 'bg-[var(--off-bg)] text-[var(--off)]',
  enviada:          'bg-[var(--run-bg)] text-[var(--run)]',
  respondida:       'bg-[var(--ok-bg)] text-[var(--ok)]',
  selecionada:      'bg-[var(--ok-bg)] text-[var(--ok)]',
  cancelada:        'bg-[var(--nc-bg)] text-[var(--nc)]',
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CotacoesPage() {
  const { solId } = useParams<{ solId: string }>()
  const solicitacaoId = Number(solId)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [novoFornecedorId, setNovoFornecedorId] = useState('')
  const [copiedLink, setCopiedLink] = useState<number | null>(null)

  const { data: cotacoes = [], isLoading } = useQuery({
    queryKey: ['cotacoes', solicitacaoId],
    queryFn: () => almoxarifadoService.listarCotacoes(solicitacaoId),
  })

  const mutCriar = useMutation({
    mutationFn: (fornecedorId: number) =>
      almoxarifadoService.criarCotacao(solicitacaoId, { fornecedor_id: fornecedorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotacoes', solicitacaoId] })
      setNovoFornecedorId('')
    },
  })

  const mutEnviar = useMutation({
    mutationFn: (id: number) => almoxarifadoService.enviarCotacao(id),
    onSuccess: async (data, id) => {
      qc.invalidateQueries({ queryKey: ['cotacoes', solicitacaoId] })
      // Copia link para área de transferência
      await navigator.clipboard.writeText(data.link)
      setCopiedLink(id)
      setTimeout(() => setCopiedLink(null), 3000)
    },
  })

  const mutCancelar = useMutation({
    mutationFn: (id: number) => almoxarifadoService.cancelarCotacao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cotacoes', solicitacaoId] }),
  })

  const respondidas = cotacoes.filter((c) => c.status === 'respondida').length
  const total = cotacoes.filter((c) => c.status !== 'cancelada').length

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-high)]">Cotações</h1>
          <p className="text-sm text-[var(--text-low)] mt-0.5">
            Solicitação #{solicitacaoId} — {total} fornecedores convidados, {respondidas} responderam
          </p>
        </div>

        <div className="flex gap-2">
          {respondidas >= 2 && (
            <button
              onClick={() => navigate(`/almoxarifado/solicitacoes/${solicitacaoId}/comparativo`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
            >
              <BarChart3 size={15} />
              Ver comparativo
            </button>
          )}
        </div>
      </div>

      {/* Aviso de mínimo de cotações */}
      {respondidas === 1 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--warn-bg)] text-[var(--warn)] text-sm">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          <span>Para emitir a ordem de compra, aguarde pelo menos 2 cotações respondidas (boas práticas de gestão).</span>
        </div>
      )}

      {/* Adicionar fornecedor */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
            ID do Fornecedor
          </label>
          <input
            type="number"
            value={novoFornecedorId}
            onChange={(e) => setNovoFornecedorId(e.target.value)}
            placeholder="Ex: 12"
            className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
        <button
          onClick={() => mutCriar.mutate(Number(novoFornecedorId))}
          disabled={!novoFornecedorId || mutCriar.isPending}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50"
        >
          <Plus size={14} />
          Convidar
        </button>
      </div>

      {/* Lista de cotações */}
      {isLoading ? (
        <div className="text-sm text-[var(--text-low)]">Carregando…</div>
      ) : cotacoes.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-low)] text-sm">
          Nenhum fornecedor convidado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {cotacoes.map((c) => (
            <CotacaoCard
              key={c.id}
              cotacao={c}
              copiedLink={copiedLink}
              onEnviar={() => mutEnviar.mutate(c.id)}
              onCancelar={() => {
                if (confirm('Cancelar esta cotação?')) mutCancelar.mutate(c.id)
              }}
              enviando={mutEnviar.isPending && mutEnviar.variables === c.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card de cotação ───────────────────────────────────────────────────────────

function CotacaoCard({
  cotacao,
  copiedLink,
  onEnviar,
  onCancelar,
  enviando,
}: {
  cotacao: AlmCotacao
  copiedLink: number | null
  onEnviar: () => void
  onCancelar: () => void
  enviando: boolean
}) {
  const pct = cotacao.total_itens
    ? Math.round(((cotacao.itens_respondidos ?? 0) / cotacao.total_itens) * 100)
    : 0

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[var(--text-high)] text-sm truncate">
              {cotacao.fornecedor_nome}
            </span>
            <span className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
              STATUS_COLOR[cotacao.status],
            )}>
              {STATUS_ICON[cotacao.status]}
              {STATUS_LABEL[cotacao.status]}
            </span>
          </div>

          {cotacao.fornecedor_email && (
            <p className="text-xs text-[var(--text-low)] mt-0.5">{cotacao.fornecedor_email}</p>
          )}

          {/* Progresso de itens respondidos */}
          {cotacao.total_itens != null && cotacao.total_itens > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] text-[var(--text-low)]">
                <span>{cotacao.itens_respondidos ?? 0}/{cotacao.total_itens} itens respondidos</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--ok)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {cotacao.subtotal != null && (
            <p className="text-xs text-[var(--text-low)] mt-1.5">
              Subtotal: <strong className="text-[var(--text-high)]">
                R$ {cotacao.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
              {cotacao.frete > 0 && (
                <> + R$ {cotacao.frete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} frete</>
              )}
            </p>
          )}

          {cotacao.respondida_at && (
            <p className="text-[11px] text-[var(--text-low)] mt-1">
              Respondida em {new Date(cotacao.respondida_at).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>

        {/* Ações */}
        {cotacao.status !== 'cancelada' && cotacao.status !== 'selecionada' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {cotacao.status === 'em_preenchimento' && (
              <button
                onClick={onEnviar}
                disabled={enviando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-50"
              >
                <Send size={12} />
                {enviando ? 'Enviando…' : 'Enviar link'}
              </button>
            )}
            {cotacao.status === 'enviada' && (
              <button
                onClick={onEnviar}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-high)]"
              >
                <Link2 size={12} />
                {copiedLink === cotacao.id ? 'Link copiado!' : 'Copiar link'}
              </button>
            )}
            <button
              onClick={onCancelar}
              className="p-1.5 rounded-lg text-[var(--off)] hover:bg-[var(--off-bg)] transition-colors"
              title="Cancelar cotação"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
