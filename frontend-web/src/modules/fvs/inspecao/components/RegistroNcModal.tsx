// frontend-web/src/modules/fvs/inspecao/components/RegistroNcModal.tsx
import { useState, useRef } from 'react';
import { useEvidencias, useCreateEvidencia, useDeleteEvidencia } from '../hooks/useRegistros';
import type { FvsRegistro } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { X, Camera } from 'lucide-react';

interface Props {
  registro: FvsRegistro;
  regime: string;
  onSalvar: (observacao: string) => void;
  onCancelar: () => void;
  salvando?: boolean;
}

export function RegistroNcModal({ registro, regime, onSalvar, onCancelar, salvando }: Props) {
  const [obs, setObs] = useState(registro.observacao ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: evidencias = [] } = useEvidencias(registro.id ?? null);
  const createEv = useCreateEvidencia();
  const deleteEv = useDeleteEvidencia();

  const isPbqph  = regime === 'pbqph';
  const isCritico = registro.item_criticidade === 'critico';
  const semFoto  = evidencias.length === 0;

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !registro.id) return;
    createEv.mutate({ registroId: registro.id, file });
    e.target.value = '';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancelar} />
      <div className="relative z-10 w-full max-w-lg bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div>
            <h3 className="text-base font-semibold text-[var(--nc-text)] m-0">Não Conforme</h3>
            <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5 max-w-[340px] truncate">{registro.item_descricao}</p>
          </div>
          <div className="flex items-center gap-2 ml-3">
            {isCritico && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]">
                CRÍTICO
              </span>
            )}
            <button onClick={onCancelar} className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
              Observação {isPbqph ? <span className="text-[var(--nc-text)]">(obrigatória)</span> : '(opcional)'}
            </label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={4}
              placeholder="Descreva a não conformidade observada..."
              className={cn(
                'w-full px-3 py-2 text-sm rounded-md border bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none resize-y transition-colors',
                isPbqph && !obs.trim() ? 'border-[var(--nc-border)] focus:border-[var(--nc-text)]' : 'border-[var(--border-dim)] focus:border-[var(--accent)]',
              )}
            />
            {isPbqph && !obs.trim() && (
              <p className="text-xs text-[var(--nc-text)] mt-1">Obrigatório em PBQP-H</p>
            )}
          </div>

          {/* Fotos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                Fotos {isPbqph && isCritico ? <span className="text-[var(--warn-text)]">(obrigatória na conclusão)</span> : '(opcional)'}
              </label>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={createEv.isPending}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
              >
                <Camera size={11} /> Foto
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </div>
            {isPbqph && isCritico && semFoto && (
              <p className="text-xs text-[var(--warn-text)] mb-2">⚠ Foto obrigatória — será validada ao concluir a ficha.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {evidencias.map(ev => (
                <div key={ev.id} className="relative">
                  <div className="w-16 h-16 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-md flex items-center justify-center text-[10px] text-[var(--text-faint)] text-center p-1 overflow-hidden">
                    {ev.nome_original ?? 'foto'}
                  </div>
                  <button
                    onClick={() => deleteEv.mutate({ id: ev.id, registroId: registro.id! })}
                    className="absolute -top-1.5 -right-1.5 bg-[var(--nc-text)] text-white rounded-full w-[16px] h-[16px] text-[10px] flex items-center justify-center hover:opacity-80"
                  >
                    ×
                  </button>
                </div>
              ))}
              {evidencias.length === 0 && (
                <span className="text-xs text-[var(--text-faint)]">Nenhuma foto</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-dim)]">
          <button
            onClick={onCancelar}
            className="px-4 py-1.5 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSalvar(obs)}
            disabled={salvando || (isPbqph && !obs.trim())}
            className="px-4 py-1.5 text-sm rounded-md bg-[var(--nc-text)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {salvando ? 'Salvando...' : 'Salvar NC'}
          </button>
        </div>
      </div>
    </div>
  );
}
