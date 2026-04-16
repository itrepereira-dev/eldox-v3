import { useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { useDelegar } from '../hooks/useAprovacoes';

// Mock de usuários — em produção viria de um hook de usuários do tenant
interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: string;
}

interface Props {
  aprovacaoId: number;
  usuarios?: Usuario[];
  onClose: () => void;
}

export function DelegarModal({ aprovacaoId, usuarios = [], onClose }: Props) {
  const delegar = useDelegar();
  const [novoAprovadorId, setNovoAprovadorId] = useState<string>('');
  const [observacao, setObservacao] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoAprovadorId) return;
    delegar.mutate(
      {
        id: aprovacaoId,
        dto: {
          novoAprovadorId: Number(novoAprovadorId),
          observacao: observacao || undefined,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-[var(--run)]" />
            <h2 className="text-base font-semibold text-[var(--text-high)]">Delegar Aprovação</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Novo Aprovador */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
              Delegar para *
            </label>
            {usuarios.length > 0 ? (
              <select
                required
                value={novoAprovadorId}
                onChange={e => setNovoAprovadorId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="">Selecione um usuário...</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nome} — {u.role}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                required
                placeholder="ID do usuário"
                value={novoAprovadorId}
                onChange={e => setNovoAprovadorId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
              Justificativa
            </label>
            <textarea
              rows={3}
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Descreva o motivo da delegação..."
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
              disabled={!novoAprovadorId || delegar.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--run)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <UserCheck size={14} />
              {delegar.isPending ? 'Delegando...' : 'Delegar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
