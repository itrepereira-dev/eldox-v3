// frontend-web/src/modules/ncs/pages/NcsGlobalPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useNcsGlobal } from '../hooks/useNcs';
import type { NaoConformidade, NcStatus, NcCriticidade } from '../../../services/ncs.service';

// ─── Badges ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<NcStatus, { label: string; cls: string }> = {
  ABERTA:      { label: 'Aberta',       cls: 'bg-red-50 text-red-700 border border-red-200' },
  EM_ANALISE:  { label: 'Em Análise',   cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  TRATAMENTO:  { label: 'Tratamento',   cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  VERIFICACAO: { label: 'Verificação',  cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  FECHADA:     { label: 'Fechada',      cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
  CANCELADA:   { label: 'Cancelada',    cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
};

const CRITICIDADE_LABEL: Record<NcCriticidade, { label: string; cls: string }> = {
  ALTA:  { label: 'Alta',  cls: 'bg-red-50 text-red-700 border border-red-200' },
  MEDIA: { label: 'Média', cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  BAIXA: { label: 'Baixa', cls: 'bg-green-50 text-green-700 border border-green-200' },
};

const CATEGORIA_LABELS: Record<string, string> = {
  CONCRETAGEM: 'Concretagem',
  FVS: 'FVS',
  FVM: 'FVM',
  ENSAIO: 'Ensaio',
  GERAL: 'Geral',
};

// ─── Página ───────────────────────────────────────────────────────────────────

export function NcsGlobalPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [criticidadeFiltro, setCriticidadeFiltro] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useNcsGlobal({
    status: statusFiltro as NcStatus || undefined,
    criticidade: criticidadeFiltro as NcCriticidade || undefined,
    search: search || undefined,
    page,
    limit: 20,
  });

  const ncs: NaoConformidade[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Painel Global de NCs</h1>
          <p className="text-sm text-[var(--text-faint)] mt-0.5">
            Todas as obras — {total} NC{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar por título ou número..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-w-[220px]"
        />
        <select
          value={statusFiltro}
          onChange={(e) => { setStatusFiltro(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as NcStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s].label}</option>
          ))}
        </select>
        <select
          value={criticidadeFiltro}
          onChange={(e) => { setCriticidadeFiltro(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">Todas as criticidades</option>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Média</option>
          <option value="BAIXA">Baixa</option>
        </select>
      </div>

      {/* Resumo de status */}
      <div className="grid grid-cols-3 gap-3 mb-6 sm:grid-cols-6">
        {(Object.keys(STATUS_LABEL) as NcStatus[]).map((s) => {
          const count = ncs.filter((n) => n.status === s).length;
          const { label, cls } = STATUS_LABEL[s];
          return (
            <button
              key={s}
              onClick={() => { setStatusFiltro(statusFiltro === s ? '' : s); setPage(1); }}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border p-3 transition-opacity hover:opacity-80',
                statusFiltro === s ? 'ring-2 ring-[var(--accent)]' : '',
                cls,
              )}
            >
              <span className="text-xl font-bold">{count}</span>
              <span className="text-xs mt-0.5">{label}</span>
            </button>
          );
        })}
      </div>

      {ncs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[var(--text-faint)] text-sm">Nenhuma NC encontrada.</p>
        </div>
      ) : (
        <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                {['Número', 'Obra', 'Título', 'Categoria', 'Criticidade', 'Status', 'Prazo', ''].map((col) => (
                  <th key={col} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ncs.map((nc, i) => {
                const st = STATUS_LABEL[nc.status] ?? { label: nc.status, cls: '' };
                const cr = CRITICIDADE_LABEL[nc.criticidade] ?? { label: nc.criticidade, cls: '' };
                return (
                  <tr
                    key={nc.id}
                    className={cn(
                      'border-b border-[var(--border-dim)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors',
                      i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-faint)]">{nc.numero}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-faint)]">#{nc.obra_id}</td>
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={() => navigate(`/obras/${nc.obra_id}/ncs/${nc.id}`)}
                        className="text-[var(--accent)] hover:underline text-left"
                      >
                        {nc.titulo}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-mid)]">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-faint)]">
                        {CATEGORIA_LABELS[nc.categoria] ?? nc.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', cr.cls)}>
                        {cr.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', st.cls)}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-faint)]">
                      {nc.prazo ? new Date(nc.prazo).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/obras/${nc.obra_id}/ncs/${nc.id}`)}
                        className="text-xs px-2.5 py-1 rounded border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 justify-end">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-[var(--text-faint)]">Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
