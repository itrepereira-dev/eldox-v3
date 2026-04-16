// src/modules/dashboard/widgets/global/ObrasStatusWidget.tsx
import { Layers } from 'lucide-react'
import { useSummary } from './_useSummary'

export function ObrasStatusWidget() {
  const { data, isLoading } = useSummary()
  const obras = data?.obras

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers size={13} className="text-[var(--run)]" />
        <span className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px]">Obras</span>
      </div>
      {isLoading ? (
        <div className="skeleton h-8 w-16 rounded" />
      ) : (
        <>
          <p className="text-3xl font-bold text-[var(--run)] leading-none">{obras?.em_execucao ?? '—'}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">em execução · {obras?.total ?? 0} total</p>
          <div className="flex gap-3 mt-2">
            <span className="text-[9px] text-[var(--warn)]">{obras?.paralisadas ?? 0} paralisadas</span>
            <span className="text-[9px] text-[var(--ok)]">{obras?.concluidas ?? 0} concluídas</span>
          </div>
        </>
      )}
    </div>
  )
}
