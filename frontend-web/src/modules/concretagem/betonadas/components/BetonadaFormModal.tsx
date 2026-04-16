// frontend-web/src/modules/concretagem/betonadas/components/BetonadaFormModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import type { CreateBetonadaPayload } from '@/services/concretagem.service';
import { useCriarBetonada } from '../hooks/useBetonadas';

interface Props {
  obraId: number;
  onClose: () => void;
}

export function BetonadaFormModal({ obraId, onClose }: Props) {
  const criar = useCriarBetonada(obraId);

  const [form, setForm] = useState<CreateBetonadaPayload>({
    elemento_estrutural: '',
    volume_previsto: 0,
    fck_especificado: 25,
    fornecedor_id: 0,
    data_programada: new Date().toISOString().split('T')[0],
  });

  const set = (key: keyof CreateBetonadaPayload, value: string | number | boolean | undefined) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await criar.mutateAsync(form);
      onClose();
    } catch {
      // erro tratado pelo react-query
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-dim)]">
          <h2 className="text-base font-semibold text-[var(--text-high)]">Nova Betonada</h2>
          <button type="button" onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={(e) => void handleSubmit(e)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
              Elemento Estrutural *
            </label>
            <input
              required
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
              placeholder="Ex: Laje P3 — Bloco A"
              value={form.elemento_estrutural}
              onChange={(e) => set('elemento_estrutural', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
                Volume Previsto (m³) *
              </label>
              <input
                required
                type="number"
                min={0.1}
                step={0.1}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                value={form.volume_previsto}
                onChange={(e) => set('volume_previsto', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
                fck Especificado (MPa) *
              </label>
              <input
                required
                type="number"
                min={10}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                value={form.fck_especificado}
                onChange={(e) => set('fck_especificado', parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
                ID Fornecedor (Concreteira) *
              </label>
              <input
                required
                type="number"
                min={1}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                value={form.fornecedor_id}
                onChange={(e) => set('fornecedor_id', parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
                Data Programada *
              </label>
              <input
                required
                type="date"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                value={form.data_programada}
                onChange={(e) => set('data_programada', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
                Traço Especificado
              </label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="Ex: C25 Bombeado"
                value={form.traco_especificado ?? ''}
                onChange={(e) => set('traco_especificado', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
                Hora Programada
              </label>
              <input
                type="time"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                value={form.hora_programada ?? ''}
                onChange={(e) => set('hora_programada', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
                Intervalo Mín. entre Caminhões (min)
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="Ex: 30"
                value={form.intervalo_min_caminhoes ?? ''}
                onChange={(e) => set('intervalo_min_caminhoes', e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="bombeado"
                checked={form.bombeado ?? false}
                onChange={(e) => set('bombeado', e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--accent)' }}
              />
              <label htmlFor="bombeado" className="text-sm text-[var(--text-high)] cursor-pointer">
                Concreto Bombeado
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-low)] mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] resize-none"
              value={form.observacoes ?? ''}
              onChange={(e) => set('observacoes', e.target.value)}
            />
          </div>

          {/* Erro */}
          {criar.isError && (
            <p className="text-xs text-[var(--nc-text)]">
              Erro ao criar betonada. Verifique os dados e tente novamente.
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--border-dim)] text-sm text-[var(--text-med)] hover:bg-[var(--bg-raised)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={criar.isPending}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {criar.isPending ? 'Salvando...' : 'Criar Betonada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
