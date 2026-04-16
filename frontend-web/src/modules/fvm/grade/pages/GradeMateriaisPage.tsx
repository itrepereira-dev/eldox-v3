// frontend-web/src/modules/fvm/grade/pages/GradeMateriaisPage.tsx
// Grade principal FVM: Material × Lote — espelhado no padrão de FichaGradePage (FVS)

import { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGradeFvm } from '../hooks/useGradeFvm';
import { LoteDrawer } from '../components/LoteDrawer';
import { NovoLoteModal } from '../components/NovoLoteModal';
import { cn } from '@/lib/cn';
import { ArrowLeft, Plus, Filter, BarChart2 } from 'lucide-react';
import { DashboardFvmTab } from '../../dashboard/DashboardFvmTab';

// ── Configurações visuais ── idêntico ao padrão FVS ──────────────────────────

export type StatusLote =
  | 'aguardando_inspecao'
  | 'em_inspecao'
  | 'aprovado'
  | 'aprovado_com_ressalva'
  | 'quarentena'
  | 'reprovado'
  | 'cancelado';

const CELL_CLS: Record<StatusLote, string> = {
  aguardando_inspecao:   'bg-[var(--border-dim)] text-[var(--text-faint)]',
  em_inspecao:           'bg-blue-400 text-white',
  aprovado:              'bg-[var(--ok-text)] text-white',
  aprovado_com_ressalva: 'bg-yellow-400 text-yellow-900',
  quarentena:            'bg-orange-400 text-white',
  reprovado:             'bg-[var(--nc-text)] text-white',
  cancelado:             'bg-[var(--bg-raised)] text-[var(--text-faint)]',
};

const CELL_ICON: Record<StatusLote, string> = {
  aguardando_inspecao:   '—',
  em_inspecao:           '◐',
  aprovado:              '✓',
  aprovado_com_ressalva: '⚡',
  quarentena:            '🔒',
  reprovado:             '✗',
  cancelado:             '✖',
};

const LEGEND: { status: StatusLote; label: string }[] = [
  { status: 'aprovado',              label: 'Aprovado' },
  { status: 'aprovado_com_ressalva', label: 'Aprovado c/ Ressalva' },
  { status: 'quarentena',            label: 'Quarentena' },
  { status: 'reprovado',             label: 'Reprovado' },
  { status: 'em_inspecao',           label: 'Em Inspeção' },
  { status: 'aguardando_inspecao',   label: 'Aguardando' },
];

// ── Componente principal ──────────────────────────────────────────────────────

export function GradeMateriaisPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const id = Number(obraId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: grade, isLoading } = useGradeFvm(id);

  // ── Estado local ───────────────────────────────────────────────────────────
  const [drawerCell, setDrawerCell]   = useState<{ materialId: number; loteId: number } | null>(null);
  const [novoLoteOpen, setNovoLoteOpen] = useState(false);
  const [aba, setAba] = useState<'grade' | 'dashboard'>('grade');

  // ── Filtros (URL-synced) — mesmo padrão FVS ───────────────────────────────
  const filtroCategoria = searchParams.get('categoria') ? Number(searchParams.get('categoria')) : null;
  const filtroStatus    = searchParams.get('status') as StatusLote | null;

  function setFiltro(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  // ── Dados filtrados (client-side) ─────────────────────────────────────────
  const materiaisFiltrados = useMemo(() => {
    if (!grade) return [];
    let mats = grade.materiais;
    if (filtroCategoria) mats = mats.filter(m => m.categoria_id === filtroCategoria);
    return mats;
  }, [grade, filtroCategoria]);

  const lotesFiltrados = useMemo(() => {
    if (!grade || !filtroStatus) return grade?.lotes ?? [];
    return grade.lotes.filter(l => {
      return materiaisFiltrados.some(
        m => (grade.celulas[m.id]?.[l.id] ?? 'aguardando_inspecao') === filtroStatus,
      );
    });
  }, [grade, filtroStatus, materiaisFiltrados]);

  // ── Categorias únicas (para filtro) ───────────────────────────────────────
  const categorias = useMemo(() => {
    if (!grade) return [];
    const seen = new Map<number, string>();
    grade.materiais.forEach(m => { if (m.categoria_id) seen.set(m.categoria_id, m.categoria_nome ?? ''); });
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome }));
  }, [grade]);

  if (isLoading || !grade) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  const { total_lotes, aprovados, quarentena, reprovados, aguardando } = grade.resumo;
  const pctAprovado = total_lotes > 0 ? Math.round((aprovados / total_lotes) * 100) : 0;

  return (
    <div className="p-6">
      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-0.5 text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0 truncate">
            Controle de Materiais
          </h1>
          <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">
            {total_lotes} {total_lotes === 1 ? 'lote registrado' : 'lotes registrados'}
          </p>
        </div>
        <button
          onClick={() => setNovoLoteOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <Plus size={15} />
          Nova Entrega
        </button>
      </div>

      {/* ── KPI bar — mesmo padrão do FVS com progresso ──────────────────── */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-raised)] overflow-hidden">
            <div
              className="h-full bg-[var(--ok-text)] rounded-full transition-all duration-300"
              style={{ width: `${pctAprovado}%` }}
            />
          </div>
          <span className="text-xs text-[var(--text-faint)] font-mono">{pctAprovado}%</span>
        </div>
        <div className="flex gap-4 text-xs text-[var(--text-faint)]">
          <span><span className="text-[var(--ok-text)] font-semibold">{aprovados}</span> aprovados</span>
          {quarentena > 0 && <span><span className="text-orange-500 font-semibold">{quarentena}</span> quarentena</span>}
          {reprovados > 0 && <span><span className="text-[var(--nc-text)] font-semibold">{reprovados}</span> reprovados</span>}
          <span><span className="font-semibold">{aguardando}</span> aguardando</span>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-[var(--border-dim)] mb-4 -mx-6 px-6">
        <button
          type="button"
          onClick={() => setAba('grade')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            aba === 'grade'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
          )}
        >
          Grade de Materiais
        </button>
        <button
          type="button"
          onClick={() => setAba('dashboard')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            aba === 'dashboard'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
          )}
        >
          <BarChart2 size={14} />
          Dashboard
        </button>
      </div>

      {aba === 'dashboard' && <DashboardFvmTab obraId={id} />}

      {aba === 'grade' && (
      <>
      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter size={14} className="text-[var(--text-faint)]" />

        {/* Filtro por Categoria */}
        <select
          value={filtroCategoria ?? ''}
          onChange={e => setFiltro('categoria', e.target.value || null)}
          className="text-xs px-2.5 py-1.5 rounded border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todas as categorias</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        {/* Filtro por Status */}
        <select
          value={filtroStatus ?? ''}
          onChange={e => setFiltro('status', e.target.value || null)}
          className="text-xs px-2.5 py-1.5 rounded border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todos os status</option>
          {LEGEND.map(l => (
            <option key={l.status} value={l.status}>{l.label}</option>
          ))}
        </select>

        {(filtroCategoria || filtroStatus) && (
          <button
            onClick={() => { setFiltro('categoria', null); setFiltro('status', null); }}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text-high)] underline"
          >
            limpar
          </button>
        )}
      </div>

      {/* ── Grade Material × Lote — padrão idêntico ao FVS ──────────────── */}
      <div className="overflow-auto border border-[var(--border-dim)] rounded-lg">
        <table className="border-collapse text-xs" style={{ minWidth: `${180 + lotesFiltrados.length * 72}px` }}>
          <thead>
            {/* Linha de cabeçalho dos lotes */}
            <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
              {/* Célula sticky do canto */}
              <th className="sticky left-0 z-20 bg-[var(--bg-raised)] border-r border-[var(--border-dim)] px-3 py-2 text-left font-semibold text-[var(--text-faint)] uppercase tracking-wide w-44 min-w-[11rem]">
                Material
              </th>
              {lotesFiltrados.map(lote => (
                <th
                  key={lote.id}
                  className="px-2 py-2 text-center font-normal text-[var(--text-faint)] min-w-[4.5rem] border-r border-[var(--border-dim)] last:border-r-0"
                >
                  <div className="font-semibold text-[var(--text-high)] leading-tight">{lote.numero_lote}</div>
                  <div className="text-[10px] text-[var(--text-faint)] leading-tight mt-0.5">{lote.data_entrega}</div>
                  <div className="text-[10px] text-[var(--text-faint)] leading-tight truncate max-w-[4rem] mx-auto">{lote.fornecedor_nome}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materiaisFiltrados.map((mat, i) => (
              <tr
                key={mat.id}
                className={cn(
                  'border-b border-[var(--border-dim)] last:border-0',
                  i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                )}
              >
                {/* Coluna sticky com nome do material */}
                <td className={cn(
                  'sticky left-0 z-10 border-r border-[var(--border-dim)] px-3 py-2',
                  i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                )}>
                  <div className="font-medium text-[var(--text-high)] leading-tight truncate max-w-[10rem]">{mat.nome}</div>
                  <div className="text-[10px] text-[var(--text-faint)] leading-tight mt-0.5">{mat.categoria_nome}</div>
                </td>

                {/* Células da grade */}
                {lotesFiltrados.map(lote => {
                  const status = (grade.celulas[mat.id]?.[lote.id] ?? 'aguardando_inspecao') as StatusLote;
                  const isCelula = grade.celulas[mat.id]?.[lote.id] !== undefined;
                  if (!isCelula) {
                    return (
                      <td key={lote.id} className="border-r border-[var(--border-dim)] last:border-r-0 py-2 px-2 text-center">
                        <span className="text-[10px] text-[var(--border-dim)]">·</span>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={lote.id}
                      className="border-r border-[var(--border-dim)] last:border-r-0 py-2 px-1 text-center"
                    >
                      <button
                        onClick={() => setDrawerCell({ materialId: mat.id, loteId: lote.id })}
                        className={cn(
                          'w-9 h-7 rounded text-[11px] font-bold transition-opacity hover:opacity-80 cursor-pointer',
                          CELL_CLS[status],
                        )}
                        title={status}
                      >
                        {CELL_ICON[status]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}

            {materiaisFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={lotesFiltrados.length + 1}
                  className="py-12 text-center text-sm text-[var(--text-faint)]"
                >
                  Nenhum material encontrado com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Legenda ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mt-3">
        {LEGEND.map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn('w-5 h-4 rounded text-[10px] font-bold flex items-center justify-center', CELL_CLS[status])}>
              {CELL_ICON[status]}
            </span>
            <span className="text-xs text-[var(--text-faint)]">{label}</span>
          </div>
        ))}
      </div>
      </>
      )}

      {/* ── Drawer do lote (equivalente ao GradeDrawer do FVS) ────────────── */}
      {drawerCell && (
        <LoteDrawer
          loteId={drawerCell.loteId}
          onClose={() => setDrawerCell(null)}
          onAbrirFicha={(loteId) => navigate(`/fvm/lotes/${loteId}`)}
        />
      )}

      {/* ── Modal Nova Entrega ────────────────────────────────────────────── */}
      {novoLoteOpen && (
        <NovoLoteModal
          obraId={id}
          onClose={() => setNovoLoteOpen(false)}
        />
      )}
    </div>
  );
}
