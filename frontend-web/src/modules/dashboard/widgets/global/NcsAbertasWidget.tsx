// src/modules/dashboard/widgets/global/NcsAbertasWidget.tsx
import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSummary } from './_useSummary'

export function NcsAbertasWidget() {
  const { data, isLoading } = useSummary()
  const ncs = data?.ncs
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col cursor-pointer" onClick={() => navigate('/ncs')}>
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle size={13} className="text-[var(--nc)]" />
        <span className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px]">NCs Abertas</span>
      </div>
      {isLoading ? (
        <div className="skeleton h-8 w-12 rounded" />
      ) : (
        <>
          <p className="text-3xl font-bold text-[var(--nc)] leading-none">{ncs?.abertas ?? '—'}</p>
          <div className="flex gap-3 mt-1.5">
            {(ncs?.criticas ?? 0) > 0 && (
              <span className="text-[9px] font-semibold text-[var(--nc)]">{ncs?.criticas} críticas</span>
            )}
            {(ncs?.vencidas ?? 0) > 0 && (
              <span className="text-[9px] text-[var(--warn)]">{ncs?.vencidas} vencidas</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
