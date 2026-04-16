// frontend-web/src/modules/fvs/planos-acao/components/PaKanban.tsx
import { PaCard } from './PaCard';
import type { PlanoAcao, PaConfigEtapa } from '../../../../services/planos-acao.service';

interface PaKanbanProps {
  pas: PlanoAcao[];
  etapas: PaConfigEtapa[];
  obraId: number;
}

export function PaKanban({ pas, etapas, obraId }: PaKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {etapas.map((etapa) => {
        const etapaPas = pas.filter((p) => p.etapa_atual_id === etapa.id);
        return (
          <div key={etapa.id} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: etapa.cor }}
              />
              <h3 className="text-[13px] font-semibold text-[var(--text-high)]">
                {etapa.nome}
              </h3>
              <span className="ml-auto text-[11px] text-[var(--text-faint)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded-full">
                {etapaPas.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {etapaPas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-dim)] p-4 text-center">
                  <p className="text-[12px] text-[var(--text-faint)]">Nenhum PA</p>
                </div>
              ) : (
                etapaPas.map((pa) => <PaCard key={pa.id} pa={pa} obraId={obraId} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
