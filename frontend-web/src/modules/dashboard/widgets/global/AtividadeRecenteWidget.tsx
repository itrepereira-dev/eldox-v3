// src/modules/dashboard/widgets/global/AtividadeRecenteWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardService } from '@/services/dashboard.service'

const COR: Record<string, string> = {
  red: 'var(--nc)', yellow: 'var(--warn)', green: 'var(--ok)',
  blue: 'var(--run)', purple: 'var(--purple)',
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function AtividadeRecenteWidget() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-feed'],
    queryFn: () => dashboardService.getFeed(15),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const items = data?.items ?? []

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Atividade Recente</p>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4].map((i) => <div key={i} className="skeleton h-4 rounded" />)}
        </div>
      ) : (
        <div className="flex flex-col overflow-y-auto flex-1">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex gap-2 items-start py-1.5 border-b border-[var(--border-dim)] last:border-0 cursor-pointer hover:bg-[var(--bg-hover)] px-1 rounded"
              onClick={() => navigate(item.link)}
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: COR[item.cor] ?? '#64748b' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[var(--text-mid)] truncate">{item.titulo}</p>
                {item.obra_nome && (
                  <p className="text-[9px] text-[var(--text-faint)]">{item.obra_nome}</p>
                )}
              </div>
              <span className="text-[9px] text-[var(--text-faint)] flex-shrink-0">{timeAgo(item.created_at)}</span>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-[10px] text-[var(--text-faint)]">Nenhuma atividade recente.</p>
          )}
        </div>
      )}
    </div>
  )
}
