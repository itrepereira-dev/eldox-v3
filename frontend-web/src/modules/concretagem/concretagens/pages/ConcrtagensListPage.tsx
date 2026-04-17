// frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagensListPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Layers, LayoutGrid, List, FlaskConical } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import type { StatusConcretagem } from '@/services/concretagem.service';
import { obrasService, type Obra } from '@/services/obras.service';
import { useListarConcretagens } from '../hooks/useConcretagens';
import { ConcrtagemFormModal } from '../components/ConcrtagemFormModal';
import { KanbanCard } from '../components/KanbanCard';

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<StatusConcretagem, string> = {
  PROGRAMADA:         'Programada',
  EM_LANCAMENTO:      'Em Lançamento',
  EM_RASTREABILIDADE: 'Em Rastreabilidade',
  CONCLUIDA:          'Concluída',
  CANCELADA:          'Cancelada',
};

const STATUS_COLORS: Record<StatusConcretagem, string> = {
  PROGRAMADA:         'bg-[var(--accent-dim)] text-[var(--accent)]',
  EM_LANCAMENTO:      'bg-[var(--warn-dim)] text-[var(--warn-text)]',
  EM_RASTREABILIDADE: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  CONCLUIDA:          'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  CANCELADA:          'bg-[var(--bg-raised)] text-[var(--text-faint)]',
};

// ── Kanban columns ────────────────────────────────────────────────────────────

const KANBAN_COLS: {
  status: StatusConcretagem;
  label: string;
  textColor: string;
  dotColor: string;
  hint: string;
}[] = [
  { status: 'PROGRAMADA',         label: 'Programadas',         textColor: 'text-[var(--accent)]',    dotColor: 'bg-[var(--accent)]',    hint: 'Agendadas para execução' },
  { status: 'EM_LANCAMENTO',      label: 'Em Lançamento',       textColor: 'text-[var(--warn-text)]', dotColor: 'bg-[var(--warn)]',      hint: 'Caminhões chegando' },
  { status: 'EM_RASTREABILIDADE', label: 'Em Rastreabilidade',  textColor: 'text-[var(--ok-text)]',   dotColor: 'bg-[var(--ok)]',        hint: 'Aguardando ruptura de CPs' },
  { status: 'CONCLUIDA',          label: 'Concluídas',          textColor: 'text-[var(--text-faint)]', dotColor: 'bg-[var(--text-faint)]', hint: 'Finalizadas' },
];

// ── Tabs para view lista ──────────────────────────────────────────────────────

type TabKey = StatusConcretagem | 'TODOS';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'TODOS',              label: 'Todas' },
  { key: 'PROGRAMADA',         label: 'Programadas' },
  { key: 'EM_LANCAMENTO',      label: 'Em Lançamento' },
  { key: 'EM_RASTREABILIDADE', label: 'Em Rastreabilidade' },
  { key: 'CONCLUIDA',          label: 'Concluídas' },
  { key: 'CANCELADA',          label: 'Canceladas' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const VIEW_KEY = 'eldox.concretagens.view';

function getInitialView(): 'kanban' | 'lista' {
  try {
    return (localStorage.getItem(VIEW_KEY) as 'kanban' | 'lista') ?? 'kanban';
  } catch {
    return 'kanban';
  }
}

function setViewPref(v: 'kanban' | 'lista') {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i} className="border-b border-[var(--border-dim)]">
          {[80, 180, 60, 60, 80, 90, 80].map((w, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded animate-pulse bg-[var(--bg-raised)]" style={{ width: w }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SkeletonCards() {
  return (
    <>
      {[1, 2].map((i) => (
        <div key={i} className="h-24 rounded-lg animate-pulse bg-[var(--bg-raised)]" />
      ))}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center mb-4">
        <Layers size={32} className="text-[var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-high)] mb-1">
        Nenhuma concretagem registrada
      </h3>
      <p className="text-sm text-[var(--text-faint)] max-w-sm mb-5">
        Programe a primeira concretagem desta obra para iniciar o controle.
      </p>
      <button
        type="button"
        onClick={onNovo}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        Nova Concretagem
      </button>
    </div>
  );
}

// ── No-obra placeholder ───────────────────────────────────────────────────────

function NoObraSelected({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-raised)] flex items-center justify-center mb-4">
        <Layers size={32} className="text-[var(--text-faint)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-high)] mb-1">
        Selecione uma obra para visualizar as concretagens
      </h3>
      <p className="text-sm text-[var(--text-faint)] max-w-sm mb-5">
        Use o filtro acima ou crie uma nova concretagem escolhendo a obra no formulário.
      </p>
      <button
        type="button"
        onClick={onNovo}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        Nova Concretagem
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConcrtagensListPage() {
  const { obraId }   = useParams<{ obraId?: string }>();
  const navigate     = useNavigate();
  const obraIdNum    = Number(obraId) || 0;

  // When coming from /concretagem (no obraId in URL) the user can filter locally
  const [filterObraId, setFilterObraId] = useState<number>(obraIdNum);

  // Obra selector data (used when no obraId in URL)
  const { data: obrasData } = useQuery({
    queryKey: ['obras-selector'],
    queryFn: () => obrasService.getAll({ limit: 100 }),
    staleTime: 60_000,
    enabled: !obraIdNum, // only fetch when we need the filter
  });
  const obrasList: Obra[] = !obraIdNum
    ? Array.isArray(obrasData)
      ? obrasData
      : ((obrasData as { items?: Obra[] })?.items ?? [])
    : [];

  // The effective obraId to use for queries
  const effectiveObraId = obraIdNum || filterObraId;

  const [view, setView]         = useState<'kanban' | 'lista'>(getInitialView);
  const [tab, setTab]           = useState<TabKey>('TODOS');
  const [modalAberto, setModal] = useState(false);

  // Kanban busca todos; lista pode filtrar por tab
  const listParams = view === 'kanban'
    ? { page: 1, limit: 200 }
    : (tab === 'TODOS' ? { page: 1, limit: 50 } : { status: tab as StatusConcretagem, page: 1, limit: 50 });

  const { data: result, isLoading, isError } = useListarConcretagens(effectiveObraId, listParams);
  const items = result?.items ?? [];

  const formatData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleToggleView = (v: 'kanban' | 'lista') => {
    setView(v);
    setViewPref(v);
  };

  const goToDetalhe = (id: number) => {
    const oid = effectiveObraId;
    navigate(`/obras/${oid}/concretagem/concretagens/${id}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* Header — icon badge + título + toggle + CTA */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--accent-dim)] to-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center">
            <FlaskConical size={20} className="text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold text-[var(--text-high)] m-0 leading-tight">Gestão de Concretagens</h1>
            <p className="text-sm text-[var(--text-faint)] mt-0.5 m-0">
              Agendamentos, acompanhamento e rastreabilidade — Kanban ou lista
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle view */}
          <div className="flex bg-[var(--bg-raised)] rounded-lg p-1 gap-0.5 border border-[var(--border-dim)]">
            <button
              type="button"
              onClick={() => handleToggleView('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-[160ms]',
                view === 'kanban'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-high)] shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-med)]',
              )}
            >
              <LayoutGrid size={13} /> Kanban
            </button>
            <button
              type="button"
              onClick={() => handleToggleView('lista')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-[160ms]',
                view === 'lista'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-high)] shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-med)]',
              )}
            >
              <List size={13} /> Lista
            </button>
          </div>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 hover:-translate-y-[1px] hover:shadow-md transition-all duration-[180ms]"
          >
            <Plus size={15} />
            Nova Concretagem
          </button>
        </div>
      </div>

      {/* ── Obra filter (only when no obraId in URL) ── */}
      {!obraIdNum && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-[var(--text-low)] whitespace-nowrap">
            Filtrar por obra
          </label>
          <select
            value={filterObraId || ''}
            onChange={(e) => setFilterObraId(Number(e.target.value) || 0)}
            className="h-9 px-3 text-sm rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] min-w-[220px]"
          >
            <option value="">Todas as obras</option>
            {obrasList.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-sm text-[var(--text-faint)]">
          Erro ao carregar concretagens
        </div>
      )}

      {/* ── No obra selected placeholder ── */}
      {!isError && !effectiveObraId && (
        <NoObraSelected onNovo={() => setModal(true)} />
      )}

      {/* ── KANBAN ── */}
      {!isError && !!effectiveObraId && view === 'kanban' && (
        <>
          {items.length === 0 && !isLoading ? (
            <EmptyState onNovo={() => setModal(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[400px]">
              {KANBAN_COLS.map((col) => {
                const colItems = items.filter((b) => b.status === col.status);
                return (
                  <div key={col.status} className="flex flex-col gap-2">
                    {/* Column header */}
                    <div className="flex items-center justify-between px-2 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('flex-shrink-0 w-2 h-2 rounded-full', col.dotColor)} />
                        <span className={cn('text-[11px] font-bold tracking-wider uppercase truncate', col.textColor)}>
                          {col.label}
                        </span>
                      </div>
                      <span className={cn(
                        'flex-shrink-0 text-[11px] font-mono font-semibold min-w-[22px] h-5 px-1.5',
                        'flex items-center justify-center rounded-full',
                        'bg-[var(--bg-raised)] text-[var(--text-med)]',
                      )}>
                        {isLoading ? '…' : colItems.length}
                      </span>
                    </div>

                    {/* Cards container */}
                    <div className="flex flex-col gap-2 flex-1 min-h-[280px] p-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-dim)]/50">
                      {isLoading ? (
                        <SkeletonCards />
                      ) : colItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-8">
                          <span className="text-xs text-[var(--text-faint)] italic">Sem items</span>
                          <span className="text-[10px] text-[var(--text-faint)]/60 mt-1">{col.hint}</span>
                        </div>
                      ) : (
                        colItems.map((b) => (
                          <KanbanCard key={b.id} item={b} onClick={() => goToDetalhe(b.id)} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── LISTA ── */}
      {!isError && !!effectiveObraId && view === 'lista' && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--border-dim)]">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  tab === key
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-low)] hover:text-[var(--text-med)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <table className="w-full text-sm border-collapse">
              <tbody><SkeletonRows /></tbody>
            </table>
          ) : items.length === 0 ? (
            <EmptyState onNovo={() => setModal(true)} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-dim)]">
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Número</th>
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Elemento Estrutural</th>
                    <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">Vol. (m³)</th>
                    <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">fck</th>
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Data Prog.</th>
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">CPs</th>
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)] cursor-pointer"
                      onClick={() => goToDetalhe(b.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--accent)]">{b.numero}</td>
                      <td className="px-4 py-3 text-[var(--text-high)] max-w-[200px] truncate">{b.elemento_estrutural}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-med)]">{Number(b.volume_previsto).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-med)]">{b.fck_especificado}</td>
                      <td className="px-4 py-3 text-[var(--text-med)]">{formatData(b.data_programada)}</td>
                      <td className="px-4 py-3 text-[var(--text-faint)] text-xs">
                        {b.cp_total > 0 ? `${b.cp_rompidos}/${b.cp_total}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[b.status])}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); goToDetalhe(b.id); }}
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-[var(--text-faint)] mt-3 px-1">
                {result?.total ?? 0} concretagem(ns) encontrada(s)
              </p>
            </div>
          )}
        </>
      )}

      {/* Modal criar */}
      {modalAberto && (
        <ConcrtagemFormModal
          obraId={effectiveObraId || undefined}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
