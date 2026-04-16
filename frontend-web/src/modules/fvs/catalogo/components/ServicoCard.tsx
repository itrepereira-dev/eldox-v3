// frontend-web/src/modules/fvs/catalogo/components/ServicoCard.tsx
import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { FvsServico, FvsItem } from '@/services/fvs.service'
import { ChevronDown, ChevronRight, Copy, Pencil, Trash2, EyeOff, Eye } from 'lucide-react'

const CRITICIDADE_STYLE: Record<string, string> = {
  critico: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]',
  maior:   'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
}

const FOTO_LABEL: Record<string, string> = {
  nenhuma:    '—',
  opcional:   '📷?',
  obrigatoria: '📷!',
}

interface Props {
  servico: FvsServico
  onClonar:      (id: number) => void
  onEditar:      (servico: FvsServico) => void
  onExcluir:     (id: number) => void
  onToggleAtivo: (id: number, ativo: boolean) => void
  onMoverItem?:  (servicoId: number, itens: { id: number; ordem: number }[]) => void
}

export function ServicoCard({ servico, onClonar, onEditar, onExcluir, onToggleAtivo, onMoverItem }: Props) {
  const [expanded, setExpanded] = useState(false)

  const handleMoverItem = (itemIndex: number, dir: -1 | 1) => {
    if (!servico.itens || !onMoverItem) return
    const itens = [...servico.itens]
    const j = itemIndex + dir
    if (j < 0 || j >= itens.length) return
    ;[itens[itemIndex], itens[j]] = [itens[j], itens[itemIndex]]
    onMoverItem(servico.id, itens.map((it, idx) => ({ id: it.id, ordem: idx })))
  }

  return (
    <div className={cn(
      'border-b border-[var(--border-dim)] last:border-0',
      !servico.ativo && 'opacity-50',
    )}>
      {/* Cabeçalho do serviço */}
      <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors">
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded
            ? <ChevronDown size={14} className="text-[var(--text-faint)] flex-shrink-0" />
            : <ChevronRight size={14} className="text-[var(--text-faint)] flex-shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {servico.codigo && (
                <span className="text-[11px] text-[var(--accent)] font-mono font-semibold">{servico.codigo}</span>
              )}
              <span className={cn(
                'text-[13px] font-medium truncate',
                servico.ativo ? 'text-[var(--text-high)]' : 'text-[var(--text-faint)] line-through',
              )}>
                {servico.nome}
              </span>
              {servico.is_sistema && (
                <span className="text-[10px] bg-[var(--run-bg)] text-[var(--run-text)] border border-[var(--run-border)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                  SISTEMA
                </span>
              )}
              {!servico.ativo && (
                <span className="text-[10px] bg-[var(--off-bg)] text-[var(--off-text)] border border-[var(--off-border)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                  INATIVO
                </span>
              )}
            </div>
            {servico.norma_referencia && (
              <span className="text-[11px] text-[var(--text-faint)]">{servico.norma_referencia}</span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <span className="text-[11px] text-[var(--text-faint)] mr-1">{servico.itens?.length ?? 0} itens</span>

          <button
            onClick={() => onClonar(servico.id)}
            title="Clonar serviço"
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors"
          >
            <Copy size={13} />
          </button>

          {!servico.is_sistema && (
            <>
              <button
                onClick={() => onToggleAtivo(servico.id, !servico.ativo)}
                title={servico.ativo ? 'Desativar serviço' : 'Ativar serviço'}
                className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors"
              >
                {servico.ativo ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                onClick={() => onEditar(servico)}
                title="Editar"
                className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onExcluir(servico.id)}
                title="Excluir"
                className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--nc)] hover:bg-[var(--nc-bg)] transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Itens expandidos */}
      {expanded && servico.itens && servico.itens.length > 0 && (
        <div className="pl-10 pr-4 pb-3 space-y-1.5">
          {servico.itens.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              index={i}
              total={servico.itens!.length}
              isSistema={servico.is_sistema}
              onMoverCima={() => handleMoverItem(i, -1)}
              onMoverBaixo={() => handleMoverItem(i, 1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemRow({
  item, index, total, isSistema, onMoverCima, onMoverBaixo,
}: {
  item: FvsItem
  index: number
  total: number
  isSistema: boolean
  onMoverCima: () => void
  onMoverBaixo: () => void
}) {
  const [showCriterio, setShowCriterio] = useState(false)

  return (
    <div className="border border-[var(--border-dim)] rounded bg-[var(--bg-raised)]">
      <div className="flex items-center gap-2 py-1 px-2">
        {/* Reordenar (só para não-sistema) */}
        {!isSistema && (
          <div className="flex flex-col gap-0 flex-shrink-0">
            <button
              onClick={onMoverCima}
              disabled={index === 0}
              className="p-0 text-[9px] text-[var(--text-faint)] disabled:opacity-20 hover:text-[var(--text-high)] leading-tight"
              title="Mover para cima"
            >▲</button>
            <button
              onClick={onMoverBaixo}
              disabled={index === total - 1}
              className="p-0 text-[9px] text-[var(--text-faint)] disabled:opacity-20 hover:text-[var(--text-high)] leading-tight"
              title="Mover para baixo"
            >▼</button>
          </div>
        )}

        <span className="text-[11px] text-[var(--text-faint)] font-mono w-4 flex-shrink-0">{index + 1}.</span>
        <span className="text-[12px] text-[var(--text-mid)] flex-1">{item.descricao}</span>

        {/* Foto modo + constraints */}
        <span
          className="text-[11px] text-[var(--text-faint)] flex-shrink-0 font-mono"
          title={`${item.foto_modo} · mín ${item.foto_minimo} · máx ${item.foto_maximo}`}
        >
          {FOTO_LABEL[item.foto_modo]}
          {item.foto_modo !== 'nenhuma' && (item.foto_minimo > 0 || item.foto_maximo !== 2) && (
            <span className="ml-0.5 text-[10px]">
              {item.foto_minimo}–{item.foto_maximo}
            </span>
          )}
        </span>

        <span className={cn('text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold flex-shrink-0', CRITICIDADE_STYLE[item.criticidade])}>
          {item.criticidade}
        </span>

        {/* Toggle detalhes técnicos */}
        {(item.criterio_aceite || item.tolerancia || item.metodo_verificacao) && (
          <button
            onClick={() => setShowCriterio(v => !v)}
            className="text-[10px] text-[var(--accent)] hover:underline flex-shrink-0"
            title="Ver detalhes técnicos"
          >
            {showCriterio ? '▲ detalhes' : '▼ detalhes'}
          </button>
        )}
      </div>

      {showCriterio && (item.criterio_aceite || item.tolerancia || item.metodo_verificacao) && (
        <div className="px-8 pb-2 pt-1.5 border-t border-[var(--border-dim)] space-y-1.5">
          {item.criterio_aceite && (
            <div>
              <p className="text-[10px] text-[var(--text-faint)] font-semibold uppercase tracking-wide mb-0.5">Critério de Aceite</p>
              <p className="text-[12px] text-[var(--text-mid)]">{item.criterio_aceite}</p>
            </div>
          )}
          {(item.tolerancia || item.metodo_verificacao) && (
            <div className="flex gap-4 flex-wrap">
              {item.tolerancia && (
                <div>
                  <p className="text-[10px] text-[var(--text-faint)] font-semibold uppercase tracking-wide mb-0.5">Tolerância</p>
                  <p className="text-[12px] text-[var(--text-mid)]">{item.tolerancia}</p>
                </div>
              )}
              {item.metodo_verificacao && (
                <div>
                  <p className="text-[10px] text-[var(--text-faint)] font-semibold uppercase tracking-wide mb-0.5">Método de Verificação</p>
                  <p className="text-[12px] text-[var(--text-mid)]">{item.metodo_verificacao}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
