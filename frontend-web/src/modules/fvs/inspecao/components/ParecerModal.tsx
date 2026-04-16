// frontend-web/src/modules/fvs/inspecao/components/ParecerModal.tsx
import { useState } from 'react';
import { useSubmitParecer } from '../hooks/useRo';
import type { FvsGrade, DecisaoParecer } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { X, CheckCircle, XCircle } from 'lucide-react';

interface ParecerModalProps {
  fichaId: number;
  regime: string;
  grade?: FvsGrade;
  onClose: () => void;
  onSuccess: () => void;
}

export function ParecerModal({ fichaId, regime, grade, onClose, onSuccess }: ParecerModalProps) {
  const [decisao, setDecisao]           = useState<DecisaoParecer | null>(null);
  const [observacao, setObservacao]     = useState('');
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroApi, setErroApi]           = useState<string | null>(null);

  const submitParecer = useSubmitParecer(fichaId);

  const ncCount = grade
    ? Object.values(grade.celulas).reduce((total, localMap) => {
        return total + Object.values(localMap).filter(s => s === 'nc').length;
      }, 0)
    : null;

  async function handleSubmit() {
    setErroValidacao(null);
    setErroApi(null);

    if (!decisao) {
      setErroValidacao('Selecione uma decisão (Aprovar ou Rejeitar).');
      return;
    }
    if (regime === 'pbqph' && decisao === 'rejeitado' && !observacao.trim()) {
      setErroValidacao('Para fichas PBQP-H com rejeição, a observação é obrigatória.');
      return;
    }

    try {
      await submitParecer.mutateAsync({ decisao, observacao: observacao.trim() || undefined });
      onSuccess();
    } catch (e: any) {
      setErroApi(e?.response?.data?.message ?? 'Erro ao emitir parecer. Tente novamente.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-base font-semibold text-[var(--text-high)] m-0">Emitir Parecer</h3>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Resumo NCs */}
          {ncCount !== null && ncCount > 0 && (
            <div className="px-3 py-2.5 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)]">
              <p className="text-xs text-[var(--text-mid)] m-0">
                Resumo da grade:{' '}
                <span className="text-[var(--nc-text)] font-bold">
                  {ncCount} célula{ncCount !== 1 ? 's' : ''} não conforme{ncCount !== 1 ? 's' : ''}
                </span>
              </p>
            </div>
          )}

          {/* Decisão */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-2">Decisão</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setDecisao('aprovado')}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-semibold transition-colors',
                  decisao === 'aprovado'
                    ? 'border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)]'
                    : 'border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)]',
                )}
              >
                <CheckCircle size={16} /> Aprovar
              </button>
              <button
                onClick={() => setDecisao('rejeitado')}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-semibold transition-colors',
                  decisao === 'rejeitado'
                    ? 'border-[var(--nc-border)] bg-[var(--nc-bg)] text-[var(--nc-text)]'
                    : 'border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)]',
                )}
              >
                <XCircle size={16} /> Rejeitar
              </button>
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
              Observação{regime === 'pbqph' && decisao === 'rejeitado' ? <span className="text-[var(--nc-text)]"> *</span> : ''}
            </label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={4}
              placeholder={
                regime === 'pbqph' && decisao === 'rejeitado'
                  ? 'Obrigatório para rejeição PBQP-H — descreva o motivo...'
                  : 'Observação opcional...'
              }
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] resize-y transition-colors"
            />
          </div>

          {/* Erros */}
          {(erroValidacao || erroApi) && (
            <p className="text-xs text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)]">
              {erroValidacao ?? erroApi}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-dim)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitParecer.isPending || !decisao}
            className={cn(
              'px-4 py-1.5 text-sm rounded-md text-white font-medium transition-opacity disabled:opacity-40',
              !decisao
                ? 'bg-[var(--text-faint)]'
                : decisao === 'aprovado'
                  ? 'bg-[var(--ok-text)] hover:opacity-90'
                  : 'bg-[var(--nc-text)] hover:opacity-90',
            )}
          >
            {submitParecer.isPending ? 'Processando...' : 'Confirmar Parecer'}
          </button>
        </div>
      </div>
    </div>
  );
}
