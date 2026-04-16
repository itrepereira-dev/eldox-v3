import { useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { useDecidir } from '../hooks/useAprovacoes';

interface Props {
  aprovacaoId: number;
  onClose: () => void;
}

export function DecidirModal({ aprovacaoId, onClose }: Props) {
  const decidir = useDecidir();
  const [decisao, setDecisao] = useState<'APROVADO' | 'REPROVADO' | ''>('');
  const [observacao, setObservacao] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisao) return;
    decidir.mutate(
      { id: aprovacaoId, dto: { decisao, observacao: observacao || undefined } },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h2 className="text-base font-semibold text-[var(--text-high)]">Registrar Decisão</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Decisão */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-2">
              Decisão *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecisao('APROVADO')}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all"
                style={
                  decisao === 'APROVADO'
                    ? {
                        borderColor: 'var(--ok)',
                        background: 'var(--ok-bg)',
                        color: 'var(--ok-text)',
                      }
                    : {
                        borderColor: 'var(--border-dim)',
                        background: 'var(--bg-base)',
                        color: 'var(--text-faint)',
                      }
                }
              >
                <CheckCircle size={16} />
                Aprovar
              </button>
              <button
                type="button"
                onClick={() => setDecisao('REPROVADO')}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all"
                style={
                  decisao === 'REPROVADO'
                    ? {
                        borderColor: 'var(--nc)',
                        background: 'var(--nc-bg)',
                        color: 'var(--nc-text)',
                      }
                    : {
                        borderColor: 'var(--border-dim)',
                        background: 'var(--bg-base)',
                        color: 'var(--text-faint)',
                      }
                }
              >
                <XCircle size={16} />
                Reprovar
              </button>
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
              Observação {decisao === 'REPROVADO' && <span className="text-[var(--nc)]">*</span>}
            </label>
            <textarea
              rows={3}
              required={decisao === 'REPROVADO'}
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder={
                decisao === 'REPROVADO'
                  ? 'Descreva o motivo da reprovação...'
                  : 'Comentário opcional...'
              }
              className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!decisao || decidir.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity disabled:opacity-40"
              style={{
                background: decisao === 'REPROVADO' ? 'var(--nc)' : decisao === 'APROVADO' ? 'var(--ok)' : 'var(--accent)',
              }}
            >
              {decidir.isPending ? 'Salvando...' : decisao === 'APROVADO' ? 'Confirmar Aprovação' : decisao === 'REPROVADO' ? 'Confirmar Reprovação' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
