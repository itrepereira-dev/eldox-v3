// src/modules/dashboard/widgets/obra/ConcretagemVolumeWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function ConcretagemVolumeWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['conc-dash', obraId],
    queryFn: () => api.get<any>(`/obras/${obraId}/concretagem/dashboard`).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const realizado = data?.volume_realizado ?? data?.volumeRealizado ?? null
  const previsto = data?.volume_previsto ?? data?.volumePrevisto ?? null
  const pct = previsto && realizado ? Math.round((realizado / previsto) * 100) : null

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Concretagem — Volume</p>
      {isLoading ? <div className="skeleton h-8 w-20 rounded" /> : (
        <>
          <p className="text-2xl font-bold text-[var(--run)] leading-none">
            {realizado !== null ? `${realizado}m³` : '—'}
          </p>
          {previsto && <p className="text-[10px] text-[var(--text-faint)] mt-1">de {previsto}m³ {pct !== null ? `(${pct}%)` : ''}</p>}
          {data?.total_betonadas !== undefined && (
            <p className="text-[9px] text-[var(--text-faint)] mt-1">{data.total_betonadas} betonadas</p>
          )}
        </>
      )}
    </div>
  )
}
