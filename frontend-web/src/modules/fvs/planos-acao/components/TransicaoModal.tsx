// frontend-web/src/modules/fvs/planos-acao/components/TransicaoModal.tsx
import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PaDynamicFields } from './PaDynamicFields';
import { useTransicionarEtapa } from '../hooks/usePlanosAcao';
import type { PlanoAcao, PaConfigEtapa } from '../../../../services/planos-acao.service';

interface TransicaoModalProps {
  pa: PlanoAcao;
  etapasProximas: PaConfigEtapa[];
  onClose: () => void;
}

export function TransicaoModal({ pa, etapasProximas, onClose }: TransicaoModalProps) {
  const [etapaParaId, setEtapaParaId] = useState<number | null>(
    etapasProximas.length === 1 ? etapasProximas[0].id : null,
  );
  const [comentario, setComentario] = useState('');
  const [camposExtras, setCamposExtras] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const transicionar = useTransicionarEtapa(pa.id);
  const etapaSelecionada = etapasProximas.find((e) => e.id === etapaParaId);

  const handleSubmit = async () => {
    if (!etapaParaId) { setError('Selecione a próxima etapa'); return; }
    setError(null);
    try {
      await transicionar.mutateAsync({ etapaParaId, comentario: comentario || undefined, camposExtras });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao transicionar etapa');
    }
  };

  const isFinal = etapaSelecionada?.is_final ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-high)]">
            {isFinal ? 'Encerrar PA' : 'Avançar Etapa'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Stage selector (only if multiple options) */}
          {etapasProximas.length > 1 && (
            <div>
              <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
                Próxima etapa <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col gap-2">
                {etapasProximas.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEtapaParaId(e.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors',
                      etapaParaId === e.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border-dim)] hover:border-[var(--accent)]',
                    )}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: e.cor }} />
                    <span className="text-[13px] text-[var(--text-high)]">{e.nome}</span>
                    {e.is_final && (
                      <span className="ml-auto text-[10px] text-emerald-600 font-semibold uppercase">
                        Encerra
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Required dynamic fields for next stage */}
          {etapaSelecionada && (pa.campos_etapa_atual?.length ?? 0) > 0 && (
            <div>
              <p className="text-[12px] font-medium text-[var(--text-medium)] mb-2">
                Campos obrigatórios da etapa "{etapaSelecionada.nome}"
              </p>
              <PaDynamicFields
                campos={pa.campos_etapa_atual ?? []}
                values={camposExtras}
                onChange={(chave, value) => setCamposExtras((prev) => ({ ...prev, [chave]: value }))}
              />
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
              Comentário
            </label>
            <textarea
              className="input-base w-full min-h-[72px] resize-y text-[13px]"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Descreva o que foi feito (opcional)"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border-dim)] text-[var(--text-medium)] hover:bg-[var(--bg-hover)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!etapaParaId || transicionar.isPending}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-lg font-medium text-white',
              'bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <ArrowRight size={14} />
            {isFinal ? 'Encerrar PA' : 'Avançar'}
          </button>
        </div>
      </div>
    </div>
  );
}
