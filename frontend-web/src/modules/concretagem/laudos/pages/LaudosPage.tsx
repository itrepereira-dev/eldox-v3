// frontend-web/src/modules/concretagem/laudos/pages/LaudosPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { concretagemService, type Laudo } from '@/services/concretagem.service';
import { cn } from '@/lib/cn';

interface Props {
  betonadaId: number;
}

const RESULT_LABELS: Record<string, string> = { PENDENTE: 'Pendente', APROVADO: 'Aprovado', REPROVADO: 'Reprovado' };
const RESULT_COLORS: Record<string, string> = {
  PENDENTE: 'bg-[var(--accent-dim)] text-[var(--accent)]',
  APROVADO: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  REPROVADO: 'bg-[var(--nc-dim)] text-[var(--nc-text)]',
};

export function LaudosSection({ betonadaId }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ numero: '', data_emissao: '', laboratorio_nome: '', tipo: 'CONCRETO' as const });

  const { data: laudos = [], isLoading } = useQuery({
    queryKey: ['laudos', betonadaId],
    queryFn: () => concretagemService.listarLaudosPorBetonada(betonadaId),
  });

  const criarMutation = useMutation({
    mutationFn: () => concretagemService.criarLaudo({ betonada_id: betonadaId, ...form }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['laudos', betonadaId] }); setShowForm(false); },
  });

  const aprovarMutation = useMutation({
    mutationFn: (id: number) => concretagemService.aprovarLaudo(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['laudos', betonadaId] }); },
  });

  const reprovarMutation = useMutation({
    mutationFn: (id: number) => concretagemService.reprovarLaudo(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['laudos', betonadaId] }); },
  });

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]';

  return (
    <div>
      <h2 className="text-base font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
        <FileText size={16} />
        Laudos de Laboratório ({laudos.length})
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="ml-auto text-xs px-3 py-1 rounded-lg font-medium"
          style={{ background: 'var(--accent)', color: 'var(--text-high)' }}
        >
          + Novo Laudo
        </button>
      </h2>

      {showForm && (
        <div className="mb-4 p-4 rounded-lg border" style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-surface)' }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Número *</label>
              <input className={inputCls} value={form.numero} onChange={(e) => setForm(p => ({ ...p, numero: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Data Emissão *</label>
              <input type="date" className={inputCls} value={form.data_emissao} onChange={(e) => setForm(p => ({ ...p, data_emissao: e.target.value }))} required />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Laboratório</label>
            <input className={inputCls} value={form.laboratorio_nome} onChange={(e) => setForm(p => ({ ...p, laboratorio_nome: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs rounded-lg border" style={{ borderColor: 'var(--border-dim)', color: 'var(--text-med)' }}>Cancelar</button>
            <button type="button" disabled={criarMutation.isPending} onClick={() => void criarMutation.mutateAsync()} className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-50" style={{ background: 'var(--accent)', color: 'white' }}>
              {criarMutation.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-8 bg-[var(--bg-raised)] rounded animate-pulse" />
      ) : laudos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Nenhum laudo registrado.</p>
      ) : (
        <div className="space-y-2">
          {laudos.map((l: Laudo) => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-surface)' }}>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--text-high)' }}>{l.numero}</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {l.tipo} · {l.laboratorio_nome ?? 'Laboratório não informado'} · {new Date(l.data_emissao).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded font-medium', RESULT_COLORS[l.resultado])}>
                {RESULT_LABELS[l.resultado]}
              </span>
              {l.resultado === 'PENDENTE' && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={aprovarMutation.isPending}
                    onClick={() => void aprovarMutation.mutateAsync(l.id)}
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: 'var(--ok-dim)', color: 'var(--ok-text)' }}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={reprovarMutation.isPending}
                    onClick={() => void reprovarMutation.mutateAsync(l.id)}
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: 'var(--nc-dim)', color: 'var(--nc-text)' }}
                  >
                    Reprovar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
