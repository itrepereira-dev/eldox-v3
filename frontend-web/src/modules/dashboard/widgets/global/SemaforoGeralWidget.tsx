// src/modules/dashboard/widgets/global/SemaforoGeralWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useNavigate } from 'react-router-dom'

const COR_DOT: Record<string, string> = {
  verde: 'var(--ok)',
  amarelo: 'var(--warn)',
  vermelho: 'var(--nc)',
}

export function SemaforoGeralWidget() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['semaforo-geral'],
    queryFn: () => api.get<any>('/semaforo').then((r) => r.data?.data ?? r.data),
    staleTime: 120_000,
  })

  const obras: any[] = Array.isArray(data) ? data : (data?.obras ?? [])

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Semáforo de Obras</p>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-5 rounded" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
          {obras.map((item: any) => (
            <div
              key={item.obra_id ?? item.id}
              className="flex items-center justify-between py-1.5 border-b border-[var(--border-dim)] last:border-0 cursor-pointer hover:bg-[var(--bg-hover)] px-1 rounded"
              onClick={() => navigate(`/obras/${item.obra_id ?? item.id}/semaforo`)}
            >
              <span className="text-[10px] text-[var(--text-mid)] truncate max-w-[120px]">
                {item.obra_nome ?? item.nome}
              </span>
              <div className="flex gap-1.5 flex-shrink-0">
                {Object.entries(item.modulos ?? {}).map(([mod, cor]: [string, any]) => (
                  <div
                    key={mod}
                    title={mod}
                    className="w-2 h-2 rounded-full"
                    style={{ background: COR_DOT[cor] ?? '#64748b' }}
                  />
                ))}
              </div>
            </div>
          ))}
          {obras.length === 0 && (
            <p className="text-[10px] text-[var(--text-faint)]">Nenhuma obra com semáforo calculado.</p>
          )}
        </div>
      )}
    </div>
  )
}
