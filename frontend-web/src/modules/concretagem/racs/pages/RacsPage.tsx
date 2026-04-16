// frontend-web/src/modules/concretagem/racs/pages/RacsPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { concretagemService, type Rac } from '@/services/concretagem.service';
import { cn } from '@/lib/cn';

interface Props { obraId: number; }

const STATUS_LABELS: Record<string, string> = { ABERTA: 'Aberta', EM_ANDAMENTO: 'Em Andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' };
const STATUS_COLORS: Record<string, string> = {
  ABERTA: 'bg-[var(--nc-dim)] text-[var(--nc-text)]',
  EM_ANDAMENTO: 'bg-[var(--warn-dim)] text-[var(--warn-text)]',
  CONCLUIDA: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  CANCELADA: 'bg-[var(--bg-raised)] text-[var(--text-faint)]',
};

export function RacsSection({ obraId }: Props) {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', descricao_problema: '', causa_raiz: '', acao_corretiva: '' });

  const { data: racs = [], isLoading } = useQuery({
    queryKey: ['racs', obraId, filterStatus],
    queryFn: () => concretagemService.listarRacs(obraId, filterStatus || undefined),
  });

  const criarMutation = useMutation({
    mutationFn: () => concretagemService.criarRac(obraId, { obra_id: obraId, ...form }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['racs', obraId] }); setShowForm(false); },
  });

  const verificarEficaciaMutation = useMutation({
    mutationFn: (id: number) => concretagemService.verificarEficaciaRac(obraId, id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['racs', obraId] }); },
  });

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-high)' }}>
          <AlertTriangle size={16} />
          RACs — Relatórios de Ação Corretiva ({racs.length})
        </h2>
        <select
          className="text-xs px-2 py-1 rounded border ml-auto"
          style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-raised)', color: 'var(--text-med)' }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" onClick={() => setShowForm(!showForm)} className="text-xs px-3 py-1 rounded-lg font-medium" style={{ background: 'var(--accent)', color: 'white' }}>
          + Novo RAC
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-surface)' }}>
          <div>
            <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Título *</label>
            <input className={inputCls} value={form.titulo} onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Descrição do Problema *</label>
            <textarea rows={3} className={inputCls} value={form.descricao_problema} onChange={(e) => setForm(p => ({ ...p, descricao_problema: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Causa Raiz</label>
              <textarea rows={2} className={inputCls} value={form.causa_raiz} onChange={(e) => setForm(p => ({ ...p, causa_raiz: e.target.value }))} style={{ resize: 'none' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Ação Corretiva</label>
              <textarea rows={2} className={inputCls} value={form.acao_corretiva} onChange={(e) => setForm(p => ({ ...p, acao_corretiva: e.target.value }))} style={{ resize: 'none' }} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs rounded-lg border" style={{ borderColor: 'var(--border-dim)', color: 'var(--text-med)' }}>Cancelar</button>
            <button type="button" disabled={criarMutation.isPending} onClick={() => void criarMutation.mutateAsync()} className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-50" style={{ background: 'var(--accent)', color: 'white' }}>
              {criarMutation.isPending ? 'Salvando…' : 'Criar RAC'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-20 bg-[var(--bg-raised)] rounded animate-pulse" />
      ) : racs.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Nenhum RAC registrado.</p>
      ) : (
        <div className="space-y-3">
          {racs.map((r: Rac) => (
            <div key={r.id} className="p-4 rounded-lg border" style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-surface)' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>{r.numero}</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-high)' }}>{r.titulo}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.eficacia_verificada && (
                    <span className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'var(--ok-dim)', color: 'var(--ok-text)' }}>
                      <CheckCircle size={10} /> Eficácia OK
                    </span>
                  )}
                  <span className={cn('text-xs px-2 py-0.5 rounded font-medium', STATUS_COLORS[r.status])}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
              </div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-med)' }}>{r.descricao_problema}</p>
              {r.acao_corretiva && (
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>→ {r.acao_corretiva}</p>
              )}
              {r.status === 'CONCLUIDA' && !r.eficacia_verificada && (
                <button
                  type="button"
                  disabled={verificarEficaciaMutation.isPending}
                  onClick={() => void verificarEficaciaMutation.mutateAsync(r.id)}
                  className="mt-2 text-xs px-3 py-1 rounded font-medium disabled:opacity-50"
                  style={{ background: 'var(--ok-dim)', color: 'var(--ok-text)', border: '1px solid var(--ok-text)' }}
                >
                  Verificar Eficácia
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
