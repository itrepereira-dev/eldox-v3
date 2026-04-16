// frontend-web/src/modules/ensaios/laboratoriais/pages/EnsaiosPage.tsx
// Listagem de Ensaios Laboratoriais com tabs + modal — SPEC 2

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EnsaioRevisao } from '@/services/ensaios.service';
import { useListarEnsaios } from '../hooks/useEnsaios';
import { EnsaioRow } from '../components/EnsaioRow';
import { EnsaioModal } from '../components/EnsaioModal';

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabKey = 'PENDENTE' | 'APROVADO' | 'TODOS';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'APROVADO', label: 'Aprovados' },
  { key: 'TODOS',    label: 'Todos'     },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="border-b border-[var(--border-dim)]">
          {[100, 140, 160, 80, 80, 80, 90].map((w, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 rounded animate-pulse bg-[var(--bg-raised)]"
                style={{ width: w }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center mb-4">
        <FlaskConical size={32} className="text-[var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-high)] mb-1">
        Nenhum ensaio registrado
      </h3>
      <p className="text-sm text-[var(--text-faint)] max-w-sm mb-5">
        Registre o primeiro ensaio laboratorial para esta obra e acompanhe os resultados e laudos.
      </p>
      <button
        type="button"
        onClick={onNovo}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        Novo Ensaio
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EnsaiosPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const obraIdNum = Number(obraId) || 0;

  const [tab, setTab] = useState<TabKey>('PENDENTE');
  const [modalAberto, setModalAberto] = useState(false);

  const queryParams = {
    obra_id: obraIdNum,
    situacao_revisao: tab !== 'TODOS' ? (tab as EnsaioRevisao['situacao']) : undefined,
  };

  const { data, isLoading, isError } = useListarEnsaios(queryParams);
  const ensaios = data?.data ?? [];

  return (
    <div className="p-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">
            Ensaios Laboratoriais
          </h1>
          <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">
            Resultados de laboratório, aprovação automática e controle de cupons
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={15} />
          Novo Ensaio
        </button>
      </div>

      {/* ── Tabs + contador ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-all font-medium',
                tab === t.key
                  ? 'bg-[var(--bg-raised)] text-[var(--text-high)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-high)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!isLoading && (
          <span className="ml-auto text-xs text-[var(--text-faint)]">
            {ensaios.length} {ensaios.length === 1 ? 'ensaio' : 'ensaios'}
          </span>
        )}
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────── */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
        {isError ? (
          <div className="flex items-center justify-center py-16 text-center px-6">
            <div>
              <p className="text-sm text-[var(--nc-text)] font-medium">Erro ao carregar ensaios</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Tente recarregar a página</p>
            </div>
          </div>
        ) : isLoading || ensaios.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                {[
                  'Data Ensaio',
                  'Laboratório',
                  'Tipos',
                  'Resultados',
                  'Próximo Cupom',
                  'Revisão',
                  '',
                ].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : (
                ensaios.map((ensaio, i) => (
                  <EnsaioRow key={ensaio.id} ensaio={ensaio} index={i} />
                ))
              )}
            </tbody>
          </table>
        ) : (
          <EmptyState onNovo={() => setModalAberto(true)} />
        )}
      </div>

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {modalAberto && (
        <EnsaioModal
          obraId={obraIdNum}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}
