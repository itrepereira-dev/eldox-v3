import { Calendar, Truck, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Concretagem, StatusConcretagem } from '@/services/concretagem.service';

const BORDER_COLORS: Record<StatusConcretagem, string> = {
  PROGRAMADA:          'border-l-[var(--accent)]',
  EM_LANCAMENTO:       'border-l-[var(--warn)]',
  EM_RASTREABILIDADE:  'border-l-[var(--ok)]',
  CONCLUIDA:           'border-l-[var(--text-faint)]',
  CANCELADA:           'border-l-[var(--text-faint)]',
};

interface KanbanCardProps {
  item: Concretagem;
  onClick: () => void;
}

export function KanbanCard({ item, onClick }: KanbanCardProps) {
  const formatData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const cpPct = item.cp_total > 0
    ? Math.round((item.cp_rompidos / item.cp_total) * 100)
    : 0;

  const showCpInfo = item.status === 'EM_RASTREABILIDADE' || item.status === 'CONCLUIDA';

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-[var(--bg-raised)] rounded-lg p-3 border-l-[3px] cursor-pointer',
        'hover:bg-[var(--bg-elevated)] transition-colors',
        BORDER_COLORS[item.status],
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-mono text-[11px] text-[var(--accent)]">{item.numero}</span>
        <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
          <Calendar size={10} />
          {formatData(item.data_programada)}
        </span>
      </div>

      {/* Elemento estrutural */}
      <p className="text-xs font-semibold text-[var(--text-high)] truncate mb-1">
        {item.elemento_estrutural}
      </p>

      {/* Volume + fck */}
      <p className="text-[11px] text-[var(--text-faint)] mb-2">
        {Number(item.volume_previsto).toFixed(1)} m³ · C{item.fck_especificado}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {item.caminhao_total > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-faint)]">
            <Truck size={9} />
            {item.caminhao_total} cam.
          </span>
        )}
        {showCpInfo && item.cp_total > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--ok-dim)] text-[var(--ok-text)]">
            <FlaskConical size={9} />
            {item.cp_rompidos}/{item.cp_total} CPs
          </span>
        )}
      </div>

      {/* Progress bar de CPs — só em rastreabilidade */}
      {showCpInfo && item.cp_total > 0 && (
        <div className="mt-2">
          <div className="h-1 bg-[var(--bg-base)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--ok)] rounded-full transition-all"
              style={{ width: `${cpPct}%` }}
            />
          </div>
          {item.proxima_ruptura_data && (
            <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
              próx: {formatData(item.proxima_ruptura_data)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
