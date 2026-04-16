// frontend-web/src/modules/concretagem/betonadas/pages/BetonadasListPage.tsx
// Listagem de Betonadas — Sprint 8
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Layers, Calendar } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StatusBetonada } from '@/services/concretagem.service';
import { useListarBetonadas } from '../hooks/useBetonadas';
import { BetonadaFormModal } from '../components/BetonadaFormModal';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<StatusBetonada, string> = {
  PROGRAMADA: 'Programada',
  EM_LANCAMENTO: 'Em Lançamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const STATUS_COLORS: Record<StatusBetonada, string> = {
  PROGRAMADA: 'bg-[var(--accent-dim)] text-[var(--accent)]',
  EM_LANCAMENTO: 'bg-[var(--warn-dim)] text-[var(--warn-text)]',
  CONCLUIDA: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  CANCELADA: 'bg-[var(--bg-raised)] text-[var(--text-faint)]',
};

type TabKey = StatusBetonada | 'TODOS';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'TODOS',         label: 'Todas' },
  { key: 'PROGRAMADA',    label: 'Programadas' },
  { key: 'EM_LANCAMENTO', label: 'Em Lançamento' },
  { key: 'CONCLUIDA',     label: 'Concluídas' },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <tr key={i} className="border-b border-[var(--border-dim)]">
          {[80, 180, 80, 80, 100, 100, 90].map((w, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded animate-pulse bg-[var(--bg-raised)]" style={{ width: w }} />
            </td>
          ))}
        </tr>
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
        Nenhuma betonada registrada
      </h3>
      <p className="text-sm text-[var(--text-faint)] max-w-sm mb-5">
        Programe a primeira concretagem desta obra para iniciar o controle de betonadas.
      </p>
      <button
        type="button"
        onClick={onNovo}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        Nova Betonada
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function BetonadasListPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const navigate   = useNavigate();
  const obraIdNum  = Number(obraId) || 0;

  const [tab, setTab]           = useState<TabKey>('TODOS');
  const [modalAberto, setModal] = useState(false);

  const params = tab === 'TODOS' ? { page: 1, limit: 50 } : { status: tab as StatusBetonada, page: 1, limit: 50 };
  const { data: result, isLoading, isError } = useListarBetonadas(obraIdNum, params);

  const items = result?.items ?? [];

  const formatData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Betonadas</h1>
          <p className="text-sm text-[var(--text-faint)] mt-0.5 m-0">
            Programação e controle de concretagens da obra
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          Nova Betonada
        </button>
      </div>

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

      {/* Tabela */}
      {isError ? (
        <div className="text-center py-12 text-sm text-[var(--nc-text)]">
          Erro ao carregar betonadas
        </div>
      ) : isLoading ? (
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
                <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">Vol. Prev. (m³)</th>
                <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">fck (MPa)</th>
                <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Data Prog.</th>
                <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)] cursor-pointer"
                  onClick={() => navigate(`/obras/${obraIdNum}/concretagem/betonadas/${b.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-high)]">{b.numero}</td>
                  <td className="px-4 py-3 text-[var(--text-high)] max-w-[200px] truncate">{b.elemento_estrutural}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-med)]">
                    {Number(b.volume_previsto).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-med)]">{b.fck_especificado}</td>
                  <td className="px-4 py-3 text-[var(--text-med)]">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatData(b.data_programada)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[b.status])}>
                      {STATUS_LABELS[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/obras/${obraIdNum}/concretagem/betonadas/${b.id}`);
                      }}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Contador */}
          <p className="text-xs text-[var(--text-faint)] mt-3 px-1">
            {result?.total ?? 0} betonada(s) encontrada(s)
          </p>
        </div>
      )}

      {/* Modal criar */}
      {modalAberto && (
        <BetonadaFormModal
          obraId={obraIdNum}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
