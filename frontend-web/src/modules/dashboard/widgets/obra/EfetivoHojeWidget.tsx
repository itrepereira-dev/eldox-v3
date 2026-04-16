// src/modules/dashboard/widgets/obra/EfetivoHojeWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function EfetivoHojeWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['efetivo-hoje', obraId],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0]
      const res = await api.get<any>(`/obras/${obraId}/efetivo`, { params: { data: hoje } })
      return res.data?.data ?? res.data
    },
    enabled: !!obraId,
    staleTime: 60_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const total = data?.total ?? data?.items?.reduce((s: number, i: any) => s + (i.quantidade ?? 0), 0) ?? null

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Efetivo Hoje</p>
      {isLoading ? <div className="skeleton h-8 w-12 rounded" /> : (
        <>
          <p className="text-3xl font-bold text-[var(--warn)] leading-none">{total ?? '—'}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">trabalhadores</p>
        </>
      )}
    </div>
  )
}
