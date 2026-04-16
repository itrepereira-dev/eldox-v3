// src/modules/dashboard/WidgetConfigModal.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { obrasService, type Obra } from '@/services/obras.service'
import type { WidgetDefinition } from './registry/types'

interface WidgetConfigModalProps {
  def: WidgetDefinition | null
  onConfirm: (config: Record<string, unknown>) => void
  onClose: () => void
}

export function WidgetConfigModal({ def, onConfirm, onClose }: WidgetConfigModalProps) {
  const [obraId, setObraId] = useState<number | ''>('')

  const { data: obras = [] } = useQuery<Obra[]>({
    queryKey: ['obras-config-modal'],
    queryFn: () => obrasService.getAll({ limit: 100 }) as Promise<Obra[]>,
    enabled: !!def?.needsObraId,
  })

  if (!def) return null

  const handleConfirm = () => {
    const config: Record<string, unknown> = {}
    if (def.needsObraId) {
      if (!obraId) return
      config.obraId = obraId
    }
    onConfirm(config)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-high)]">Configurar — {def.titulo}</h3>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        {def.needsObraId && (
          <div className="mb-4">
            <label className="block text-xs text-[var(--text-faint)] mb-1.5">Obra</label>
            <select
              value={obraId}
              onChange={(e) => setObraId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">Selecione uma obra...</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-high)]">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={def.needsObraId && !obraId}
            className="px-4 py-1.5 text-xs bg-[var(--accent)] text-white rounded font-medium disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
