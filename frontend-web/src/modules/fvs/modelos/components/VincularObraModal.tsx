// frontend-web/src/modules/fvs/modelos/components/VincularObraModal.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { obrasService, type Obra } from '../../../../services/obras.service';
import { useObrasModelo, useVincularObrasModelo } from '../hooks/useModelos';
import { cn } from '@/lib/cn';
import { X, Building2 } from 'lucide-react';

interface Props {
  modeloId: number;
  modeloNome: string;
  onClose: () => void;
}

export function VincularObraModal({ modeloId, modeloNome, onClose }: Props) {
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState('');

  const { data: vinculadas = [] } = useObrasModelo(modeloId);
  const vincular = useVincularObrasModelo(modeloId);

  const vinculadasIds = new Set(vinculadas.map(o => o.obra_id));

  const { data: todasObras = [], isLoading } = useQuery({
    queryKey: ['obras-lista'],
    queryFn: async () => {
      const res = await obrasService.getAll({ limit: 200 });
      return (Array.isArray(res) ? res : ((res as any).items ?? [])) as Obra[];
    },
  });

  const disponiveis = todasObras.filter(o => !vinculadasIds.has(o.id));

  function toggle(id: number) {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleVincular() {
    if (!selecionadas.size) return;
    setErro('');
    try {
      await vincular.mutateAsync([...selecionadas]);
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao vincular obras');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-high)] m-0">Vincular Obras</h3>
            <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5 truncate max-w-[300px]">
              {modeloNome}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Obras já vinculadas (somente leitura) */}
        {vinculadas.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b border-[var(--border-dim)]">
            <p className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-2">
              Já vinculadas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {vinculadas.map(v => (
                <span key={v.id} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]">
                  <Building2 size={10} /> {v.obra_nome}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Lista de obras disponíveis */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          {isLoading ? (
            <p className="text-sm text-[var(--text-faint)] text-center py-8">Carregando obras...</p>
          ) : disponiveis.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)] text-center py-8">
              {vinculadasIds.size > 0 ? 'Todas as obras já estão vinculadas.' : 'Nenhuma obra cadastrada.'}
            </p>
          ) : (
            disponiveis.map(obra => {
              const checked = selecionadas.has(obra.id);
              return (
                <label
                  key={obra.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    checked
                      ? 'bg-[var(--accent-subtle,#eff6ff)] border-[var(--accent-border,#bfdbfe)]'
                      : 'bg-[var(--bg-raised)] border-[var(--border-dim)] hover:bg-[var(--bg-hover)]',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(obra.id)}
                    className="accent-[var(--accent)] w-4 h-4 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium m-0 truncate', checked ? 'text-[var(--accent)]' : 'text-[var(--text-high)]')}>
                      {obra.nome}
                    </p>
                    <p className="text-xs text-[var(--text-faint)] m-0">
                      {obra.codigo} · {obra.status.replace('_', ' ')}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* Erro */}
        {erro && (
          <p className="mx-4 text-xs text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)]">
            {erro}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-dim)]">
          <span className="text-xs text-[var(--text-faint)]">
            {selecionadas.size > 0 ? `${selecionadas.size} obra(s) selecionada(s)` : 'Nenhuma selecionada'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleVincular}
              disabled={selecionadas.size === 0 || vincular.isPending}
              className="px-4 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {vincular.isPending ? 'Vinculando...' : 'Vincular'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
