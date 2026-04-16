// frontend-web/src/modules/fvs/planos-acao/components/NovoPaModal.tsx
import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCreatePa } from '../hooks/usePlanosAcao';
import { useCiclos } from '../hooks/useConfigPlanosAcao';
import type { PaPrioridade } from '../../../../services/planos-acao.service';

interface NovoPaModalProps {
  obraId: number;
  onClose: () => void;
}

const PRIORIDADES: PaPrioridade[] = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

export function NovoPaModal({ obraId, onClose }: NovoPaModalProps) {
  const [cicloId, setCicloId]     = useState('');
  const [titulo, setTitulo]       = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<PaPrioridade>('MEDIA');
  const [prazo, setPrazo]         = useState('');
  const [error, setError]         = useState<string | null>(null);

  const { data: ciclos } = useCiclos('FVS');
  const createPa = useCreatePa();

  const handleSubmit = async () => {
    if (!cicloId)  { setError('Selecione um ciclo'); return; }
    if (!titulo.trim()) { setError('Informe o título do PA'); return; }
    setError(null);
    try {
      await createPa.mutateAsync({
        cicloId: Number(cicloId),
        obraId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        prioridade,
        prazo: prazo || undefined,
        origemTipo: 'MANUAL',
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao criar PA');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-high)]">Novo Plano de Ação</h2>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Ciclo */}
          <div>
            <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
              Ciclo <span className="text-red-500">*</span>
            </label>
            <select
              className="input-base w-full text-[13px]"
              value={cicloId}
              onChange={(e) => setCicloId(e.target.value)}
            >
              <option value="">Selecione o ciclo…</option>
              {ciclos?.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-base w-full text-[13px]"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Descreva o desvio ou ação necessária"
              maxLength={200}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
              Descrição
            </label>
            <textarea
              className="input-base w-full min-h-[72px] resize-y text-[13px]"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes adicionais (opcional)"
            />
          </div>

          {/* Prioridade + Prazo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
                Prioridade
              </label>
              <select
                className="input-base w-full text-[13px]"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as PaPrioridade)}
              >
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
                Prazo
              </label>
              <input
                type="date"
                className="input-base w-full text-[13px]"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
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
            disabled={createPa.isPending}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-lg font-medium text-white',
              'bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Plus size={14} />
            Criar PA
          </button>
        </div>
      </div>
    </div>
  );
}
