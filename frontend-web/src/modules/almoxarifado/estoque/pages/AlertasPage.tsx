// frontend-web/src/modules/almoxarifado/estoque/pages/AlertasPage.tsx
import { useParams, Link } from 'react-router-dom'
import { AlertOctagon, Clock, TrendingUp, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAlertas, useMarcarAlertaLido, useMarcarTodosLidos } from '../hooks/useEstoque'
import type { AlmAlertaEstoque } from '../../_service/almoxarifado.service'

function AlertaCard({ alerta, onLer }: { alerta: AlmAlertaEstoque; onLer: (id: number) => void }) {
  const isCritico = alerta.nivel === 'critico'

  const Icon =
    alerta.tipo === 'anomalia' ? TrendingUp :
    alerta.tipo === 'reposicao_prevista' ? Clock :
    AlertOctagon

  function fmtData(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className={cn(
      'flex items-start gap-3 p-4 border-b border-[var(--border-dim)] last:border-0',
      'hover:bg-[var(--bg-raised)] transition-colors',
    )}>
      <div className={cn(
        'flex-shrink-0 w-9 h-9 rounded-sm flex items-center justify-center',
        isCritico
          ? 'bg-[var(--nc-bg)] text-[var(--nc)]'
          : 'bg-[var(--warn-bg)] text-[var(--warn)]',
      )}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
            isCritico
              ? 'bg-[var(--nc-bg)] text-[var(--nc)]'
              : 'bg-[var(--warn-bg)] text-[var(--warn)]',
          )}>
            {isCritico ? 'Crítico' : 'Atenção'}
          </span>
          <span className="text-[11px] text-[var(--text-faint)] font-mono">
            {fmtData(alerta.criado_at)}
          </span>
        </div>
        <p className="text-[13px] font-semibold text-[var(--text-high)]">{alerta.catalogo_nome}</p>
        <p className="text-[12px] text-[var(--text-low)] mt-0.5">{alerta.mensagem}</p>
      </div>
      <button
        onClick={() => onLer(alerta.id)}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-sm',
          'border border-[var(--border-dim)] text-[var(--text-faint)]',
          'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
        )}
      >
        Marcar lido
      </button>
    </div>
  )
}

export function AlertasPage() {
  const { obraId } = useParams<{ obraId: string }>()
  const id = Number(obraId)

  const { data: alertas = [], isLoading } = useAlertas(id)
  const marcarLido     = useMarcarAlertaLido(id)
  const marcarTodos    = useMarcarTodosLidos(id)

  const criticos = alertas.filter((a) => a.nivel === 'critico')
  const atencao  = alertas.filter((a) => a.nivel === 'atencao')

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <Link
          to={`/almoxarifado/estoque`}
          className="text-[var(--text-faint)] hover:text-[var(--text-high)] text-[12px]"
        >
          ← Estoque
        </Link>
        <span className="text-[var(--text-faint)]">/</span>
        <h1 className="text-[18px] font-bold text-[var(--text-high)]">Alertas de Estoque</h1>
        <div className="flex-1" />
        {alertas.length > 0 && (
          <button
            onClick={() => marcarTodos.mutate()}
            disabled={marcarTodos.isPending}
            className={cn(
              'flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-sm',
              'border border-[var(--border-dim)] text-[var(--text-low)] bg-[var(--bg-raised)]',
              'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
              'disabled:opacity-50',
            )}
          >
            <CheckSquare size={13} />
            Marcar todos como lido
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-md" />
          ))}
        </div>
      ) : alertas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-faint)]">
          <CheckSquare size={32} className="mb-3 text-[var(--ok)]" />
          <p className="text-[14px] font-medium text-[var(--text-high)]">Nenhum alerta ativo</p>
          <p className="text-[12px] mt-1">Todos os estoques estão dentro dos limites configurados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {criticos.length > 0 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--nc-bg)] bg-[rgba(248,81,73,.04)] flex items-center gap-2">
                <AlertOctagon size={14} className="text-[var(--nc)]" />
                <span className="text-[13px] font-semibold text-[var(--nc)]">
                  Críticos ({criticos.length})
                </span>
              </div>
              {criticos.map((a) => (
                <AlertaCard key={a.id} alerta={a} onLer={(id) => marcarLido.mutate(id)} />
              ))}
            </div>
          )}

          {atencao.length > 0 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--warn-bg)] bg-[rgba(210,153,34,.04)] flex items-center gap-2">
                <AlertOctagon size={14} className="text-[var(--warn)]" />
                <span className="text-[13px] font-semibold text-[var(--warn)]">
                  Atenção ({atencao.length})
                </span>
              </div>
              {atencao.map((a) => (
                <AlertaCard key={a.id} alerta={a} onLer={(id) => marcarLido.mutate(id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
