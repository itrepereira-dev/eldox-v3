// src/modules/dashboard/AddWidgetDrawer.tsx
import { useState } from 'react'
import { X, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { widgetRegistry } from './registry'
import type { WidgetDefinition } from './registry/types'

const MODULOS = ['global', 'obras', 'fvs', 'concretagem', 'ensaios', 'almoxarifado', 'efetivo', 'ged', 'ncs', 'fvm', 'rdo']
const MODULO_LABEL: Record<string, string> = {
  global: 'Global', obras: 'Obras', fvs: 'FVS', concretagem: 'Concretagem',
  ensaios: 'Ensaios', almoxarifado: 'Almoxarifado', efetivo: 'Efetivo',
  ged: 'GED', ncs: 'NCs', fvm: 'FVM', rdo: 'Diário',
}

interface AddWidgetDrawerProps {
  open: boolean
  onClose: () => void
  onAdd: (def: WidgetDefinition) => void
}

export function AddWidgetDrawer({ open, onClose, onAdd }: AddWidgetDrawerProps) {
  const [search, setSearch] = useState('')
  const [activeModulo, setActiveModulo] = useState('global')

  const all = widgetRegistry.getAll()
  const filtered = all.filter((d) => {
    const matchModulo = activeModulo === 'global' ? d.tier === 1 : d.modulo === activeModulo
    const matchSearch = !search || d.titulo.toLowerCase().includes(search.toLowerCase())
    return matchModulo && matchSearch
  })

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[360px] bg-[var(--bg-surface)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-dim)]">
          <h2 className="text-sm font-semibold text-[var(--text-high)]">Adicionar widget</h2>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[var(--border-dim)]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar widget..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Tabs de módulo */}
        <div className="flex gap-1 p-2 border-b border-[var(--border-dim)] flex-wrap">
          {MODULOS.map((m) => (
            <button
              key={m}
              onClick={() => setActiveModulo(m)}
              className={cn(
                'px-2 py-1 text-[10px] rounded font-medium transition-colors',
                activeModulo === m
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-raised)] text-[var(--text-faint)] hover:text-[var(--text-high)]',
              )}
            >
              {MODULO_LABEL[m]}
            </button>
          ))}
        </div>

        {/* Lista de widgets */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {filtered.length === 0 && (
            <p className="text-xs text-[var(--text-faint)] text-center mt-8">Nenhum widget encontrado</p>
          )}
          {filtered.map((def) => (
            <button
              key={def.id}
              onClick={() => onAdd(def)}
              className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-dim)] hover:border-[var(--accent)] text-left transition-colors group"
            >
              <span className="text-[var(--text-low)] group-hover:text-[var(--accent)] mt-0.5 flex-shrink-0">
                {def.icone}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-high)] truncate">{def.titulo}</p>
                <p className="text-[10px] text-[var(--text-faint)] mt-0.5 line-clamp-2">{def.descricao}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
