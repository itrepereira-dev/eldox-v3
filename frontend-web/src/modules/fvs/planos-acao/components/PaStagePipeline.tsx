// frontend-web/src/modules/fvs/planos-acao/components/PaStagePipeline.tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PaConfigEtapa } from '../../../../services/planos-acao.service';

interface PaStagePipelineProps {
  etapas: PaConfigEtapa[];
  etapaAtualId: number;
}

export function PaStagePipeline({ etapas, etapaAtualId }: PaStagePipelineProps) {
  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const atualIdx = sorted.findIndex((e) => e.id === etapaAtualId);

  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {sorted.map((etapa, idx) => {
        const isAtual     = etapa.id === etapaAtualId;
        const isConcluida = idx < atualIdx;

        return (
          <div key={etapa.id} className="flex items-center min-w-0">
            {/* Stage bubble */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'text-[11px] font-bold border-2 transition-colors',
                  isAtual
                    ? 'text-white border-transparent'
                    : isConcluida
                    ? 'border-transparent text-white'
                    : 'border-[var(--border-dim)] bg-[var(--bg-surface)] text-[var(--text-faint)]',
                )}
                style={
                  isAtual || isConcluida
                    ? { backgroundColor: etapa.cor }
                    : undefined
                }
              >
                {isConcluida ? <Check size={14} /> : idx + 1}
              </div>
              <span
                className={cn(
                  'mt-1 text-[10px] whitespace-nowrap max-w-[80px] text-center truncate',
                  isAtual ? 'font-semibold text-[var(--text-high)]' : 'text-[var(--text-faint)]',
                )}
              >
                {etapa.nome}
              </span>
            </div>

            {/* Connector */}
            {idx < sorted.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-8 flex-shrink-0 -mt-4',
                  isConcluida ? 'bg-[var(--accent)]' : 'bg-[var(--border-dim)]',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
