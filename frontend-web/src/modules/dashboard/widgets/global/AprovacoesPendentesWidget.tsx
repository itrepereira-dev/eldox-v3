// src/modules/dashboard/widgets/global/AprovacoesPendentesWidget.tsx
import { Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSummary } from './_useSummary'

export function AprovacoesPendentesWidget() {
  const { data, isLoading } = useSummary()
  const pendentes = data?.aprovacoes?.pendentes_do_usuario ?? 0
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col cursor-pointer" onClick={() => navigate('/aprovacoes')}>
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={13} className="text-[var(--warn)]" />
        <span className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px]">Aprovações</span>
      </div>
      {isLoading ? (
        <div className="skeleton h-8 w-12 rounded" />
      ) : (
        <>
          <p className="text-3xl font-bold leading-none" style={{ color: pendentes > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            {pendentes}
          </p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">
            {pendentes === 0 ? 'Em dia ✓' : 'aguardando você'}
          </p>
        </>
      )}
    </div>
  )
}
