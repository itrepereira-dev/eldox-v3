// frontend-web/src/modules/fvs/planos-acao/pages/PlanosAcaoPage.tsx
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePlanosAcao } from '../hooks/usePlanosAcao';
import { useCiclos } from '../hooks/useConfigPlanosAcao';
import { PaCard } from '../components/PaCard';
import { PaKanban } from '../components/PaKanban';
import { NovoPaModal } from '../components/NovoPaModal';
import type { PaConfigEtapa } from '../../../../services/planos-acao.service';

type ViewMode = 'list' | 'kanban';

export function PlanosAcaoPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const numericObraId = Number(obraId);

  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showNovo, setShowNovo] = useState(false);

  const etapaId    = searchParams.get('etapaId')    ? Number(searchParams.get('etapaId'))    : undefined;
  const prioridade = searchParams.get('prioridade') ?? undefined;
  const page       = searchParams.get('page')       ? Number(searchParams.get('page'))       : 1;

  const { data, isLoading, isError } = usePlanosAcao({
    obraId: numericObraId, etapaId, prioridade, page, modulo: 'FVS',
  });
  const { data: ciclos } = useCiclos('FVS');

  // Collect all unique stages from active cycles for kanban columns
  const todasEtapas: PaConfigEtapa[] = [];
  if (ciclos) {
    for (const ciclo of ciclos) {
      for (const etapa of ciclo.etapas ?? []) {
        if (!todasEtapas.find((e) => e.id === etapa.id)) {
          todasEtapas.push(etapa);
        }
      }
    }
    todasEtapas.sort((a, b) => a.ordem - b.ordem);
  }

  const setFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm animate-pulse">
        Carregando planos de ação…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500 text-sm">
        Erro ao carregar planos de ação.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-high)]">Planos de Ação</h1>
          <p className="text-[13px] text-[var(--text-faint)] mt-0.5">
            {data?.total ?? 0} plano(s) encontrado(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--border-dim)] overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-3 py-1.5 text-[12px] flex items-center gap-1',
                viewMode === 'kanban'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-faint)] hover:bg-[var(--bg-hover)]',
              )}
            >
              <LayoutGrid size={13} /> Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 text-[12px] flex items-center gap-1',
                viewMode === 'list'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-faint)] hover:bg-[var(--bg-hover)]',
              )}
            >
              <List size={13} /> Lista
            </button>
          </div>

          <button
            onClick={() => setShowNovo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90"
          >
            <Plus size={14} /> Novo PA
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="input-base text-[12px] h-8 min-w-[140px]"
          value={prioridade ?? ''}
          onChange={(e) => setFilter('prioridade', e.target.value || undefined)}
        >
          <option value="">Todas prioridades</option>
          <option value="BAIXA">Baixa</option>
          <option value="MEDIA">Média</option>
          <option value="ALTA">Alta</option>
          <option value="CRITICA">Crítica</option>
        </select>

        <select
          className="input-base text-[12px] h-8 min-w-[160px]"
          value={etapaId ?? ''}
          onChange={(e) => setFilter('etapaId', e.target.value || undefined)}
        >
          <option value="">Todas as etapas</option>
          {todasEtapas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {!data?.items.length ? (
        <div className="flex flex-col items-center justify-center h-48 text-[var(--text-faint)] gap-2">
          <p className="text-[14px]">Nenhum plano de ação encontrado.</p>
          <button
            onClick={() => setShowNovo(true)}
            className="text-[13px] text-[var(--accent)] underline"
          >
            Criar primeiro PA
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        <PaKanban
          pas={data.items}
          etapas={todasEtapas}
          obraId={numericObraId}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.items.map((pa) => (
            <PaCard key={pa.id} pa={pa} obraId={numericObraId} />
          ))}
        </div>
      )}

      {/* Pagination (list mode) */}
      {viewMode === 'list' && (data?.total ?? 0) > 30 && (
        <div className="flex justify-center gap-2 mt-2">
          <button
            disabled={page <= 1}
            onClick={() => setFilter('page', String(page - 1))}
            className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--border-dim)] disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-[12px] text-[var(--text-faint)]">
            Página {page}
          </span>
          <button
            disabled={(data?.items.length ?? 0) < 30}
            onClick={() => setFilter('page', String(page + 1))}
            className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--border-dim)] disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {showNovo && (
        <NovoPaModal obraId={numericObraId} onClose={() => setShowNovo(false)} />
      )}
    </div>
  );
}
