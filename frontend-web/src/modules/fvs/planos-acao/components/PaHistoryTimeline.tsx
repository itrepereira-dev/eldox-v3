// frontend-web/src/modules/fvs/planos-acao/components/PaHistoryTimeline.tsx
import { ArrowRight } from 'lucide-react';
import type { PaHistoricoEntry } from '../../../../services/planos-acao.service';

interface PaHistoryTimelineProps {
  historico: PaHistoricoEntry[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
}

export function PaHistoryTimeline({ historico }: PaHistoryTimelineProps) {
  if (!historico.length) {
    return <p className="text-[13px] text-[var(--text-faint)]">Nenhum histórico.</p>;
  }

  return (
    <ol className="relative border-l border-[var(--border-dim)] ml-3">
      {historico.map((entry) => (
        <li key={entry.id} className="mb-6 ml-5">
          <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg-surface)]">
            <ArrowRight size={10} className="text-white" />
          </span>

          <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] p-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {entry.etapa_de_nome && (
                <>
                  <span className="text-[12px] text-[var(--text-faint)]">{entry.etapa_de_nome}</span>
                  <ArrowRight size={12} className="text-[var(--text-faint)]" />
                </>
              )}
              <span className="text-[12px] font-semibold text-[var(--text-high)]">
                {entry.etapa_para_nome}
              </span>
              <span className="ml-auto text-[11px] text-[var(--text-faint)]">
                {timeAgo(entry.created_at)}
              </span>
            </div>
            {entry.comentario && (
              <p className="text-[12px] text-[var(--text-medium)] mt-1 italic">
                "{entry.comentario}"
              </p>
            )}
            <p className="text-[11px] text-[var(--text-faint)] mt-1">
              Por usuário #{entry.criado_por}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
