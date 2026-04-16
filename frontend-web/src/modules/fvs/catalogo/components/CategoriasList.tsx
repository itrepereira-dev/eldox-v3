// frontend-web/src/modules/fvs/catalogo/components/CategoriasList.tsx
import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { FvsCategoria } from '@/services/fvs.service'
import { Plus, Check, X } from 'lucide-react'

interface Props {
  categorias: FvsCategoria[]
  selectedId: number | null
  onSelect:          (id: number) => void
  onNovaCategoria:   () => void
  onRenomear:        (id: number, nome: string) => void
  onReordenar:       (itens: { id: number; ordem: number }[]) => void
  onToggleAtivo:     (id: number, ativo: boolean) => void
}

export function CategoriasList({
  categorias, selectedId,
  onSelect, onNovaCategoria, onRenomear, onReordenar, onToggleAtivo,
}: Props) {
  const sistema = categorias.filter(c => c.is_sistema)
  const tenant  = categorias.filter(c => !c.is_sistema)

  const moverTenant = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= tenant.length) return
    const next = [...tenant]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onReordenar(next.map((c, i) => ({ id: c.id, ordem: i })))
  }

  return (
    <div className="flex flex-col h-full border-r border-[var(--border-dim)]">
      <div className="px-4 py-3 border-b border-[var(--border-dim)]">
        <p className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide">Categorias</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {sistema.length > 0 && (
          <>
            <p className="px-4 pt-2 pb-1 text-[10px] text-[var(--text-faint)] uppercase tracking-wide">PBQP-H / Sistema</p>
            {sistema.map(cat => (
              <CatItem
                key={cat.id}
                cat={cat}
                selected={selectedId === cat.id}
                canEdit={false}
                onSelect={onSelect}
                onRenomear={onRenomear}
                onToggleAtivo={onToggleAtivo}
                onMoverCima={() => {}}
                onMoverBaixo={() => {}}
                isFirst={true}
                isLast={true}
              />
            ))}
          </>
        )}
        {tenant.length > 0 && (
          <>
            <p className="px-4 pt-3 pb-1 text-[10px] text-[var(--text-faint)] uppercase tracking-wide">Personalizadas</p>
            {tenant.map((cat, idx) => (
              <CatItem
                key={cat.id}
                cat={cat}
                selected={selectedId === cat.id}
                canEdit={true}
                onSelect={onSelect}
                onRenomear={onRenomear}
                onToggleAtivo={onToggleAtivo}
                onMoverCima={() => moverTenant(idx, -1)}
                onMoverBaixo={() => moverTenant(idx, 1)}
                isFirst={idx === 0}
                isLast={idx === tenant.length - 1}
              />
            ))}
          </>
        )}
      </div>

      <div className="p-3 border-t border-[var(--border-dim)]">
        <button
          onClick={onNovaCategoria}
          className={cn(
            'flex items-center gap-1.5 w-full px-3 py-2 rounded-sm text-[12px]',
            'text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors',
          )}
        >
          <Plus size={12} />
          Nova Categoria
        </button>
      </div>
    </div>
  )
}

function CatItem({
  cat, selected, canEdit,
  onSelect, onRenomear, onToggleAtivo,
  onMoverCima, onMoverBaixo,
  isFirst, isLast,
}: {
  cat: FvsCategoria
  selected: boolean
  canEdit: boolean
  onSelect: (id: number) => void
  onRenomear: (id: number, nome: string) => void
  onToggleAtivo: (id: number, ativo: boolean) => void
  onMoverCima: () => void
  onMoverBaixo: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cat.nome)

  const confirmar = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== cat.nome) onRenomear(cat.id, trimmed)
    setEditing(false)
  }

  const cancelar = () => { setDraft(cat.nome); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') cancelar() }}
          className="flex-1 h-7 px-2 text-[12px] bg-[var(--bg-surface)] border border-[var(--accent)] rounded outline-none text-[var(--text-high)]"
        />
        <button onClick={confirmar} className="p-1 text-[var(--ok)] hover:text-[var(--ok)]"><Check size={12} /></button>
        <button onClick={cancelar} className="p-1 text-[var(--text-faint)] hover:text-[var(--text-high)]"><X size={12} /></button>
      </div>
    )
  }

  return (
    <div className={cn(
      'group flex items-center w-full',
      selected
        ? 'bg-[var(--accent-dim)] border-l-2 border-[var(--accent)]'
        : 'hover:bg-[var(--bg-hover)]',
      !cat.ativo && 'opacity-50',
    )}>
      <button
        onClick={() => onSelect(cat.id)}
        className="flex-1 px-4 py-2.5 text-left truncate text-[13px] transition-colors"
        style={{ color: selected ? 'var(--accent)' : 'var(--text-mid)' }}
      >
        {cat.nome}
        {!cat.ativo && <span className="ml-1 text-[10px] text-[var(--text-faint)]">(inativo)</span>}
      </button>

      {/* Ações inline (só visíveis no hover) */}
      {canEdit && (
        <div className="flex items-center gap-0 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onMoverCima}
            disabled={isFirst}
            title="Mover para cima"
            className="p-0.5 text-[9px] text-[var(--text-faint)] disabled:opacity-20 hover:text-[var(--text-high)] leading-none"
          >▲</button>
          <button
            onClick={onMoverBaixo}
            disabled={isLast}
            title="Mover para baixo"
            className="p-0.5 text-[9px] text-[var(--text-faint)] disabled:opacity-20 hover:text-[var(--text-high)] leading-none"
          >▼</button>
          <button
            onClick={() => { setDraft(cat.nome); setEditing(true) }}
            title="Renomear"
            className="p-1 text-[10px] text-[var(--text-faint)] hover:text-[var(--text-high)]"
          >✎</button>
          <button
            onClick={() => onToggleAtivo(cat.id, !cat.ativo)}
            title={cat.ativo ? 'Desativar' : 'Ativar'}
            className="p-1 text-[10px] text-[var(--text-faint)] hover:text-[var(--text-high)]"
          >{cat.ativo ? '⊘' : '✓'}</button>
        </div>
      )}
    </div>
  )
}
