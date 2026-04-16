// frontend-web/src/modules/concretagem/betonadas/components/MoldagemCpModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { useMoldagemCp } from '../hooks/useBetonadas';

interface CaminhaoOpt {
  id: number;
  sequencia: number;
  numero_nf: string;
}

interface Props {
  betonadaId: number;
  obraId: number;
  caminhoes: CaminhaoOpt[];
  onClose: () => void;
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]';

const labelCls = 'block text-xs font-medium text-[var(--text-faint)] mb-1';

const TODAY = new Date().toISOString().split('T')[0];
const IDADES = [3, 7, 28] as const;

export default function MoldagemCpModal({ betonadaId, obraId, caminhoes, onClose }: Props) {
  const [caminhaoId, setCaminhaoId] = useState(caminhoes[0]?.id.toString() ?? '');
  const [dataMoldagem, setDataMoldagem] = useState(TODAY);
  const [idadesSelecionadas, setIdadesSelecionadas] = useState<Set<number>>(new Set([3, 7, 28]));
  const [laboratorioId, setLaboratorioId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const mutation = useMoldagemCp(obraId, betonadaId);

  function toggleIdade(idade: number) {
    setIdadesSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(idade)) next.delete(idade);
      else next.add(idade);
      return next;
    });
  }

  // If all 3 checked or none checked → omit idade_dias (backend creates all 3)
  function resolveIdadeDias(): number | undefined {
    const sel = idadesSelecionadas.size;
    if (sel === 0 || sel === 3) return undefined;
    if (sel === 1) return [...idadesSelecionadas][0];
    return undefined; // 2 checked — omit, backend will create all 3
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const idadeDias = resolveIdadeDias();
    await mutation.mutateAsync({
      caminhao_id: parseInt(caminhaoId),
      data_moldagem: dataMoldagem,
      ...(idadeDias !== undefined && { idade_dias: idadeDias }),
      ...(laboratorioId && { laboratorio_id: parseInt(laboratorioId) }),
      ...(observacoes.trim() && { observacoes: observacoes.trim() }),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl shadow-2xl"
        style={{ background: 'var(--bg-surface)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-dim)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-high)' }}>
            Moldar Corpo de Prova
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
            <label className={labelCls}>Caminhão *</label>
            <select
              className={inputCls}
              value={caminhaoId}
              onChange={(e) => setCaminhaoId(e.target.value)}
              required
            >
              {caminhoes.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.sequencia} — NF {c.numero_nf}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Data Moldagem *</label>
            <input
              type="date"
              className={inputCls}
              value={dataMoldagem}
              onChange={(e) => setDataMoldagem(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelCls}>Idades</label>
            <div className="flex gap-4 mt-1">
              {IDADES.map((idade) => (
                <label
                  key={idade}
                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                  style={{ color: 'var(--text-mid)' }}
                >
                  <input
                    type="checkbox"
                    checked={idadesSelecionadas.has(idade)}
                    onChange={() => toggleIdade(idade)}
                    className="accent-[var(--accent)]"
                  />
                  {idade}d
                </label>
              ))}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
              Por padrão, CPs são criados para 3, 7 e 28 dias.
            </p>
          </div>

          <div>
            <label className={labelCls}>Laboratório ID</label>
            <input
              type="number"
              className={inputCls}
              value={laboratorioId}
              onChange={(e) => setLaboratorioId(e.target.value)}
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
              Erro ao moldar CP. Tente novamente.
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
              disabled={mutation.isPending || !caminhaoId}
              className="px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-high)' }}
            >
              {mutation.isPending ? 'Salvando…' : 'Moldar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
