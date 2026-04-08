// frontend-web/src/modules/fvs/catalogo/components/CategoriasList.tsx
import { cn } from '@/lib/cn'
import type { FvsCategoria } from '@/services/fvs.service'
import { Plus } from 'lucide-react'

interface Props {
  categorias: FvsCategoria[]
  selectedId: number | null
  onSelect: (id: number) => void
  onNovaCategoria: () => void
}

export function CategoriasList({ categorias, selectedId, onSelect, onNovaCategoria }: Props) {
  const sistema = categorias.filter(c => c.is_sistema)
  const tenant  = categorias.filter(c => !c.is_sistema)

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
              <CatItem key={cat.id} cat={cat} selected={selectedId === cat.id} onSelect={onSelect} />
            ))}
          </>
        )}
        {tenant.length > 0 && (
          <>
            <p className="px-4 pt-3 pb-1 text-[10px] text-[var(--text-faint)] uppercase tracking-wide">Personalizadas</p>
            {tenant.map(cat => (
              <CatItem key={cat.id} cat={cat} selected={selectedId === cat.id} onSelect={onSelect} />
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

function CatItem({ cat, selected, onSelect }: { cat: FvsCategoria; selected: boolean; onSelect: (id: number) => void }) {
  return (
    <button
      onClick={() => onSelect(cat.id)}
      className={cn(
        'flex items-center justify-between w-full px-4 py-2.5 text-left',
        'text-[13px] transition-colors',
        selected
          ? 'bg-[var(--accent-dim)] text-[var(--accent)] border-l-2 border-[var(--accent)]'
          : 'text-[var(--text-mid)] hover:bg-[var(--bg-hover)]',
      )}
    >
      <span className="truncate">{cat.nome}</span>
    </button>
  )
}
