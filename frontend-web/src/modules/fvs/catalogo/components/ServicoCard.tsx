// frontend-web/src/modules/fvs/catalogo/components/ServicoCard.tsx
import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { FvsServico } from '@/services/fvs.service'
import { ChevronDown, ChevronRight, Copy, Pencil, Trash2 } from 'lucide-react'

const CRITICIDADE_STYLE: Record<string, string> = {
  critico: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]',
  maior:   'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
}

interface Props {
  servico: FvsServico
  onClonar: (id: number) => void
  onEditar: (servico: FvsServico) => void
  onExcluir: (id: number) => void
}

export function ServicoCard({ servico, onClonar, onEditar, onExcluir }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-[var(--border-dim)] last:border-0">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors">
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher itens' : 'Expandir itens'}
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
              <span className="text-[13px] font-medium text-[var(--text-high)] truncate">{servico.nome}</span>
              {servico.is_sistema && (
                <span className="text-[10px] bg-[var(--run-bg)] text-[var(--run-text)] border border-[var(--run-border)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                  SISTEMA
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
            title="Clonar"
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors"
          >
            <Copy size={13} />
          </button>
          {!servico.is_sistema && (
            <>
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

      {expanded && servico.itens && servico.itens.length > 0 && (
        <div className="pl-10 pr-4 pb-3 space-y-1">
          {servico.itens.map((item, i) => (
            <div key={item.id} className="flex items-start gap-2 py-1">
              <span className="text-[11px] text-[var(--text-faint)] font-mono w-4 flex-shrink-0 pt-0.5">{i + 1}.</span>
              <span className="text-[12px] text-[var(--text-mid)] flex-1">{item.descricao}</span>
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold flex-shrink-0', CRITICIDADE_STYLE[item.criticidade])}>
                {item.criticidade}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
