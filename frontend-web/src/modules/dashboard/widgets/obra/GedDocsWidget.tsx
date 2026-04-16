// src/modules/dashboard/widgets/obra/GedDocsWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { useObraConfig } from './_useObraConfig'
import { api } from '@/services/api'

export function GedDocsWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['ged-stats-widget', obraId],
    queryFn: () => api.get<any>(`/ged/obras/${obraId}/stats`).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">GED — Documentos</p>
      {isLoading ? <div className="flex flex-col gap-1.5">{[1,2].map(i => <div key={i} className="skeleton h-4 rounded" />)}</div> : (
        <div className="grid grid-cols-2 gap-1.5 flex-1">
          {[
            { label: 'Vigentes', val: data?.vigentes, color: 'var(--ok)' },
            { label: 'Pend. IFA', val: data?.ifa, color: 'var(--warn)' },
            { label: 'Vencem 30d', val: data?.vencendo30dias ?? data?.vencendo_30d, color: 'var(--nc)' },
            { label: 'Rejeitados', val: data?.rejeitados, color: 'var(--text-faint)' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-[var(--bg-raised)] rounded p-2">
              <p className="text-[8px] text-[var(--text-faint)]">{label}</p>
              <p className="text-base font-bold" style={{ color }}>{val ?? '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
