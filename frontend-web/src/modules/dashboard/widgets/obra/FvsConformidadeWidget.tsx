// src/modules/dashboard/widgets/obra/FvsConformidadeWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function FvsConformidadeWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['fvs-dash', obraId],
    queryFn: () => api.get<any>(`/fvs/dashboard/obras/${obraId}`).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const taxa = data?.taxa_conformidade ?? data?.taxa ?? null

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">FVS — Conformidade</p>
      {isLoading ? <div className="skeleton h-8 w-16 rounded" /> : (
        <>
          <p className="text-3xl font-bold leading-none" style={{ color: taxa >= 80 ? 'var(--ok)' : taxa >= 60 ? 'var(--warn)' : 'var(--nc)' }}>
            {taxa !== null ? `${taxa.toFixed(0)}%` : '—'}
          </p>
          <div className="mt-2 bg-[var(--bg-raised)] rounded-sm h-1.5 overflow-hidden">
            <div className="h-full rounded-sm transition-all" style={{
              width: `${taxa ?? 0}%`,
              background: taxa >= 80 ? 'var(--ok)' : taxa >= 60 ? 'var(--warn)' : 'var(--nc)',
            }} />
          </div>
          {data?.total_fichas !== undefined && (
            <p className="text-[9px] text-[var(--text-faint)] mt-1">{data.total_fichas} fichas · {data.total_ncs ?? 0} NCs</p>
          )}
        </>
      )}
    </div>
  )
}
