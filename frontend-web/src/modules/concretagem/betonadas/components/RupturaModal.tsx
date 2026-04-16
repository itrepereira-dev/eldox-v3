// frontend-web/src/modules/concretagem/betonadas/components/RupturaModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { useRegistrarRuptura } from '../hooks/useBetonadas';

interface Props {
  cpId: number;
  numero: string;
  idadeDias: number;
  obraId: number;
  betonadaId: number;
  onClose: () => void;
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]';

const labelCls = 'block text-xs font-medium text-[var(--text-faint)] mb-1';

export default function RupturaModal({ cpId, numero, idadeDias, obraId, betonadaId, onClose }: Props) {
  const [resistencia, setResistencia] = useState('');
  const [dataRupturaReal, setDataRupturaReal] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const mutation = useRegistrarRuptura(obraId, betonadaId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await mutation.mutateAsync({
      cpId,
      payload: {
        resistencia: parseFloat(resistencia),
        ...(dataRupturaReal && { data_ruptura_real: dataRupturaReal }),
        ...(observacoes.trim() && { observacoes: observacoes.trim() }),
      },
    });
    onClose();
  }

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
            Registrar Ruptura — CP {numero} ({idadeDias}d)
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
            <label className={labelCls}>Resistência (MPa) *</label>
            <input
              type="number"
              min="0"
              step="0.1"
              className={inputCls}
              value={resistencia}
              onChange={(e) => setResistencia(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelCls}>Data Ruptura Real</label>
            <input
              type="date"
              className={inputCls}
              value={dataRupturaReal}
              onChange={(e) => setDataRupturaReal(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Observações</label>
            <textarea
              rows={3}
              className={inputCls}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {mutation.isError && (
            <p className="text-xs" style={{ color: 'var(--nc-text)' }}>
              Erro ao registrar ruptura. Tente novamente.
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
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-high)' }}
            >
              {mutation.isPending ? 'Salvando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
