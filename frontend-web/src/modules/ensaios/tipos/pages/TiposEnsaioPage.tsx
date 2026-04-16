// frontend-web/src/modules/ensaios/tipos/pages/TiposEnsaioPage.tsx
// Listagem + ações de Tipos de Ensaio — Sprint 5

import { useState } from 'react';
import { Plus, Download, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TipoEnsaio, MaterialTipo } from '@/services/ensaios.service';
import { useListarTipos, useSeedPadrao } from '../hooks/useTiposEnsaio';
import { TipoEnsaioRow } from '../components/TipoEnsaioRow';
import { TipoEnsaioModal } from '../components/TipoEnsaioModal';

// ── Tipos de filtro ───────────────────────────────────────────────────────────

type TabFiltro = 'ativos' | 'inativos' | 'todos';

const TABS: { key: TabFiltro; label: string }[] = [
  { key: 'ativos',   label: 'Ativos'   },
  { key: 'inativos', label: 'Inativos' },
  { key: 'todos',    label: 'Todos'    },
];

const MATERIAL_OPTIONS: { value: MaterialTipo | ''; label: string }[] = [
  { value: '',              label: 'Todos os materiais' },
  { value: 'bloco_concreto', label: 'Bloco de Concreto'  },
  { value: 'concreto',       label: 'Concreto'           },
  { value: 'argamassa',      label: 'Argamassa'          },
  { value: 'aco',            label: 'Aço'                },
  { value: 'ceramica',       label: 'Cerâmica'           },
  { value: 'outro',          label: 'Outro'              },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="border-b border-[var(--border-dim)]">
          {[180, 60, 120, 100, 80, 50, 60].map((w, j) => (
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

function EmptyState({ onSeed, isSeedPending }: { onSeed: () => void; isSeedPending: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      {/* Ícone laboratório */}
      <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center mb-4">
        <FlaskConical size={32} className="text-[var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-high)] mb-1">
        Nenhum tipo de ensaio configurado
      </h3>
      <p className="text-sm text-[var(--text-faint)] max-w-sm mb-5">
        Configure os tipos de ensaio e seus valores de referência NBR para habilitar a aprovação automática de laudos.
      </p>
      <button
        type="button"
        onClick={onSeed}
        disabled={isSeedPending}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isSeedPending ? (
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Download size={15} />
        )}
        Carregar padrões NBR
      </button>
      <p className="text-xs text-[var(--text-faint)] mt-2">
        Carrega os 5 tipos padrão: Bloco, Prisma Cheio, Prisma Vazio, Graute e Concreto
      </p>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TiposEnsaioPage() {
  const [tab, setTab] = useState<TabFiltro>('ativos');
  const [materialFiltro, setMaterialFiltro] = useState<MaterialTipo | ''>('');
  const [tipoEditando, setTipoEditando] = useState<TipoEnsaio | null | undefined>(undefined);
  // undefined = modal fechado | null = criação | TipoEnsaio = edição

  const queryParams = {
    ativo:        tab === 'todos' ? undefined : tab === 'ativos',
    material_tipo: materialFiltro || undefined,
  };

  const { data: tipos = [], isLoading, isError } = useListarTipos(queryParams);
  // Total sem filtros — para decidir se seed está disponível (independente da aba/filtro ativo)
  const { data: todosTipos = [] } = useListarTipos({});
  const seed = useSeedPadrao();

  const podeSeed = todosTipos.length < 5;

  const handleSeed = () => {
    seed.mutate();
  };

  return (
    <div className="p-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">
            Tipos de Ensaio
          </h1>
          <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">
            Valores de referência NBR para aprovação automática de laudos
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSeed}
            disabled={seed.isPending || !podeSeed}
            title={!podeSeed ? 'Já há 5 ou mais tipos cadastrados' : 'Carregar 5 tipos padrão das normas NBR'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-all',
              podeSeed
                ? 'border-[var(--border-dim)] text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--border)] bg-[var(--bg-surface)]'
                : 'border-[var(--border-dim)] text-[var(--text-faint)] opacity-40 cursor-not-allowed bg-[var(--bg-surface)]',
            )}
          >
            {seed.isPending ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Carregar padrões NBR
          </button>

          <button
            type="button"
            onClick={() => setTipoEditando(null)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Novo Tipo
          </button>
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4">
        {/* Tabs ativo/inativo/todos */}
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

        {/* Select material */}
        <select
          value={materialFiltro}
          onChange={(e) => setMaterialFiltro(e.target.value as MaterialTipo | '')}
          className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md px-3 py-1.5 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        >
          {MATERIAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Contador */}
        {!isLoading && (
          <span className="ml-auto text-xs text-[var(--text-faint)]">
            {tipos.length} {tipos.length === 1 ? 'tipo' : 'tipos'}
          </span>
        )}
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────── */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
        {isError ? (
          <div className="flex items-center justify-center py-16 text-center px-6">
            <div>
              <p className="text-sm text-[var(--nc-text)] font-medium">Erro ao carregar tipos de ensaio</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Tente recarregar a página</p>
            </div>
          </div>
        ) : isLoading || tipos.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                {[
                  'Nome',
                  'Unidade',
                  'Referência NBR',
                  'Norma',
                  'Frequência',
                  'Status',
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
                tipos.map((tipo, i) => (
                  <TipoEnsaioRow
                    key={tipo.id}
                    tipo={tipo}
                    index={i}
                    onEditar={(t) => setTipoEditando(t)}
                  />
                ))
              )}
            </tbody>
          </table>
        ) : (
          <EmptyState onSeed={handleSeed} isSeedPending={seed.isPending} />
        )}
      </div>

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {tipoEditando !== undefined && (
        <TipoEnsaioModal
          tipo={tipoEditando}
          onClose={() => setTipoEditando(undefined)}
        />
      )}
    </div>
  );
}
