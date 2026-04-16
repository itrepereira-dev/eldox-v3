// src/modules/dashboard/widgets/obra/EnsaiosLaudosWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function EnsaiosLaudosWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['ensaios-kpi', obraId],
    queryFn: () => api.get<any>('/dashboard/materiais', { params: { obra_id: obraId } }).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Ensaios — Laudos</p>
      {isLoading ? <div className="skeleton h-8 w-12 rounded" /> : (
        <>
          <p className="text-3xl font-bold text-[var(--warn)] leading-none">{data?.laudos_pendentes ?? '—'}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">laudos pendentes</p>
          <div className="flex gap-3 mt-1.5">
            {data?.taxa_conformidade !== undefined && (
              <span className="text-[9px] text-[var(--ok)]">{data.taxa_conformidade.toFixed(0)}% conformidade</span>
            )}
            {data?.proximos_cupons_7d > 0 && (
              <span className="text-[9px] text-[var(--warn)]">{data.proximos_cupons_7d} cupons em 7d</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
