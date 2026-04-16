// frontend-web/src/modules/concretagem/concretagens/components/RejeitarCaminhaoModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { useRejeitarCaminhao } from '../hooks/useConcretagens';

interface Props {
  caminhaoId: number;
  sequencia: number;
  obraId: number;
  concrtagemId: number;
  onClose: () => void;
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]';

const labelCls = 'block text-xs font-medium text-[var(--text-faint)] mb-1';

export default function RejeitarCaminhaoModal({
  caminhaoId,
  sequencia,
  obraId,
  concrtagemId,
  onClose,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const mutation = useRejeitarCaminhao(obraId, concrtagemId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (motivo.trim().length < 10) return;
    await mutation.mutateAsync({ caminhaoId, motivo: motivo.trim() });
    onClose();
  }

  const motivoInvalido = motivo.trim().length > 0 && motivo.trim().length < 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-sm rounded-xl shadow-2xl"
        style={{ background: 'var(--bg-surface)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-dim)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-high)' }}>
            Rejeitar Caminhão #{sequencia}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:opacity-70"
            style={{ color: 'var(--text-faint)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Motivo da Rejeição *</label>
            <textarea
              rows={4}
              className={inputCls}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
              minLength={10}
              style={{ resize: 'vertical' }}
            />
            {motivoInvalido && (
              <p className="text-xs mt-1" style={{ color: 'var(--nc-text)' }}>
                O motivo deve ter pelo menos 10 caracteres.
              </p>
            )}
          </div>

          {mutation.isError && (
            <p className="text-xs" style={{ color: 'var(--nc-text)' }}>
              Erro ao rejeitar caminhão. Tente novamente.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: 'var(--border-dim)', color: 'var(--text-mid)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || motivo.trim().length < 10}
              className="px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-50"
              style={{ background: 'var(--nc-bg)', color: 'var(--nc-text)' }}
            >
              {mutation.isPending ? 'Rejeitando…' : 'Rejeitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
