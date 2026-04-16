// frontend-web/src/modules/fvs/planos-acao/components/PaCard.tsx
import { Link } from 'react-router-dom';
import { Calendar, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PlanoAcao } from '../../../../services/planos-acao.service';

const PRIORIDADE_STYLES: Record<string, string> = {
  BAIXA:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  MEDIA:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ALTA:    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CRITICA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface PaCardProps {
  pa: PlanoAcao;
  obraId: number;
}

function isSlaVencido(prazo: string | null): boolean {
  if (!prazo) return false;
  return new Date(prazo) < new Date();
}

export function PaCard({ pa, obraId }: PaCardProps) {
  const vencido = isSlaVencido(pa.prazo);

  return (
    <Link
      to={`/obras/${obraId}/fvs/planos-acao/${pa.id}`}
      className={cn(
        'block rounded-lg border p-3 transition-shadow hover:shadow-md',
        'bg-[var(--bg-surface)] border-[var(--border-dim)]',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-mono text-[var(--text-faint)]">{pa.numero}</span>
        <span
          className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
            PRIORIDADE_STYLES[pa.prioridade] ?? PRIORIDADE_STYLES.MEDIA,
          )}
        >
          {pa.prioridade}
        </span>
      </div>

      <p className="text-[13px] font-medium text-[var(--text-high)] line-clamp-2 mb-2">
        {pa.titulo}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-[var(--text-faint)]">
        {pa.responsavel_id && (
          <span className="flex items-center gap-1">
            <User size={11} />
            #{pa.responsavel_id}
          </span>
        )}
        {pa.prazo && (
          <span className={cn('flex items-center gap-1', vencido && 'text-red-500 font-semibold')}>
            {vencido && <AlertTriangle size={11} />}
            <Calendar size={11} />
            {new Date(pa.prazo).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: pa.etapa_cor }}
        />
        <span className="text-[11px] text-[var(--text-faint)]">{pa.etapa_nome}</span>
      </div>
    </Link>
  );
}
