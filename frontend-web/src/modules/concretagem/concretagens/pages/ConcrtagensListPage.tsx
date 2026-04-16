// frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagensListPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Layers, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StatusConcretagem } from '@/services/concretagem.service';
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

const KANBAN_COLS: { status: StatusConcretagem; label: string; color: string }[] = [
  { status: 'PROGRAMADA',         label: 'Programadas',         color: 'text-[var(--accent)]' },
  { status: 'EM_LANCAMENTO',      label: 'Em Lançamento',       color: 'text-[var(--warn-text)]' },
  { status: 'EM_RASTREABILIDADE', label: 'Em Rastreabilidade',  color: 'text-[var(--ok-text)]' },
  { status: 'CONCLUIDA',          label: 'Concluídas',          color: 'text-[var(--text-faint)]' },
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConcrtagensListPage() {
  const { obraId }    = useParams<{ obraId: string }>();
  const navigate      = useNavigate();
  const obraIdNum     = Number(obraId) || 0;

  const [view, setView]       = useState<'kanban' | 'lista'>(getInitialView);
  const [tab, setTab]         = useState<TabKey>('TODOS');
  const [modalAberto, setModal] = useState(false);

  // Kanban busca todos; lista pode filtrar por tab
  const listParams = view === 'kanban'
    ? { page: 1, limit: 200 }
    : (tab === 'TODOS' ? { page: 1, limit: 50 } : { status: tab as StatusConcretagem, page: 1, limit: 50 });

  const { data: result, isLoading, isError } = useListarConcretagens(obraIdNum, listParams);
  const items = result?.items ?? [];

  const formatData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleToggleView = (v: 'kanban' | 'lista') => {
    setView(v);
    setViewPref(v);
  };

  const goToDetalhe = (id: number) =>
    navigate(`/obras/${obraIdNum}/concretagem/concretagens/${id}`);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Concretagens</h1>
          <p className="text-sm text-[var(--text-faint)] mt-0.5 m-0">
            Programação e controle de concretagens da obra
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle view */}
          <div className="flex bg-[var(--bg-raised)] rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => handleToggleView('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === 'kanban'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-high)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-med)]',
              )}
            >
              <LayoutGrid size={13} /> Kanban
            </button>
            <button
              type="button"
              onClick={() => handleToggleView('lista')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === 'lista'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-high)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-med)]',
              )}
            >
              <List size={13} /> Lista
            </button>
          </div>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Nova Concretagem
          </button>
        </div>
      </div>

      {isError && (
        <div className="text-center py-12 text-sm text-[var(--text-faint)]">
          Erro ao carregar concretagens
        </div>
      )}

      {/* ── KANBAN ── */}
      {!isError && view === 'kanban' && (
        <>
          {items.length === 0 && !isLoading ? (
            <EmptyState onNovo={() => setModal(true)} />
          ) : (
            <div className="grid grid-cols-4 gap-4 min-h-[400px]">
              {KANBAN_COLS.map((col) => {
                const colItems = items.filter((b) => b.status === col.status);
                return (
                  <div key={col.status} className="flex flex-col gap-2">
                    {/* Column header */}
                    <div className="flex items-center justify-between px-1 mb-1">
                      <span className={cn('text-xs font-bold tracking-wide uppercase', col.color)}>
                        {col.label}
                      </span>
                      <span className="text-xs text-[var(--text-faint)] bg-[var(--bg-raised)] px-1.5 py-0.5 rounded-full">
                        {isLoading ? '…' : colItems.length}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="flex flex-col gap-2 flex-1 min-h-[200px] p-2 rounded-xl bg-[var(--bg-base)]">
                      {isLoading ? (
                        <SkeletonCards />
                      ) : colItems.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-xs text-[var(--text-faint)]">
                          Nenhuma
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
      {!isError && view === 'lista' && (
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
        <ConcrtagemFormModal obraId={obraIdNum} onClose={() => setModal(false)} />
      )}
    </div>
  );
}
