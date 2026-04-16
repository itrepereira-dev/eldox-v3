// src/modules/dashboard/widgets/obra/NcsPorObraWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import { useObraConfig } from './_useObraConfig'

export function NcsPorObraWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['ncs-obra-widget', obraId],
    queryFn: () => api.get<any>(`/obras/${obraId}/ncs`, { params: { page: 1, limit: 5 } }).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 60_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const abertas = data?.total ?? data?.meta?.total ?? 0

  return (
    <div className="h-full flex flex-col cursor-pointer" onClick={() => navigate(`/obras/${obraId}/ncs`)}>
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">NCs desta Obra</p>
      {isLoading ? <div className="skeleton h-8 w-12 rounded" /> : (
        <>
          <p className="text-3xl font-bold text-[var(--nc)] leading-none">{abertas}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">abertas</p>
        </>
      )}
    </div>
  )
}
