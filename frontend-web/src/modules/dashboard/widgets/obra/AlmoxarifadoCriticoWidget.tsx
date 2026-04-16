// src/modules/dashboard/widgets/obra/AlmoxarifadoCriticoWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function AlmoxarifadoCriticoWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['alm-dash', obraId],
    queryFn: () => api.get<any>(`/almoxarifado/obras/${obraId}/dashboard`).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const criticos: any[] = data?.materiais_criticos ?? data?.alertas ?? []

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Estoque Crítico</p>
      {isLoading ? (
        <div className="flex flex-col gap-1.5">{[1,2,3].map((i) => <div key={i} className="skeleton h-4 rounded" />)}</div>
      ) : criticos.length === 0 ? (
        <p className="text-[10px] text-[var(--ok)]">Estoque normalizado ✓</p>
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
          {criticos.slice(0, 5).map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-[var(--border-dim)] last:border-0">
              <span className="text-[10px] text-[var(--text-mid)] truncate max-w-[120px]">{item.nome ?? item.material_nome}</span>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                background: item.nivel === 'CRITICO' ? 'var(--nc-bg)' : 'var(--warn-bg)',
                color: item.nivel === 'CRITICO' ? 'var(--nc)' : 'var(--warn)',
              }}>
                {item.nivel ?? 'ATENÇÃO'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
