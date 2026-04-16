import { useContagemPendentes } from '../hooks/useAprovacoes';

export function PendentesCountBadge() {
  const { data } = useContagemPendentes();

  if (!data?.total || data.total === 0) return null;

  return (
    <span
      className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5
        flex items-center justify-center rounded-full text-[10px] font-bold
        bg-[var(--warn)] text-[var(--bg-void)]"
    >
      {data.total > 99 ? '99+' : data.total}
    </span>
  );
}
