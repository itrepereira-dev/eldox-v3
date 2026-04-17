// frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useFichas, useDeleteFicha } from '../hooks/useFichas';
import { fvsService } from '../../../../services/fvs.service';
import type { FichaFvs } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { Plus } from 'lucide-react';
import { SkeletonList } from '@/components/ui';

const REGIME_LABEL: Record<string, string> = {
  pbqph:         'PBQP-H',
  norma_tecnica: 'Norma Técnica',
  livre:         'Livre',
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  rascunho:           { label: 'Rascunho',        cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
  em_inspecao:        { label: 'Em Inspeção',      cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  concluida:          { label: 'Concluída',         cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
  aguardando_parecer: { label: 'Aguard. Parecer',  cls: 'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]' },
  aprovada:           { label: 'Aprovada',          cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
};

export function FichasListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useFichas(undefined, page);
  const deleteFicha = useDeleteFicha();

  // KPI: fetch all fichas (high limit) to compute status counts across all pages
  // TODO: replace with a dedicated /fvs/fichas/kpis count endpoint to avoid large payload
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['fvs-fichas-kpi'],
    queryFn: () => fvsService.getFichas({ limit: 9999 }),
    staleTime: 60_000,
  });

  const todasFichas: FichaFvs[] = kpiData?.data ?? [];
  const kpiReady = !kpiLoading && kpiData !== undefined;
  const kpiPendentes  = kpiReady ? todasFichas.filter(f => f.status === 'rascunho' || f.status === 'em_inspecao' || f.status === 'aguardando_parecer').length : null;
  const kpiAprovadas  = kpiReady ? todasFichas.filter(f => f.status === 'aprovada').length : null;
  const kpiConcluidas = kpiReady ? todasFichas.filter(f => f.status === 'concluida').length : null;

  const fichas: FichaFvs[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="h-7 w-32 rounded-md bg-[var(--bg-hover)] animate-pulse" />
          <div className="h-9 w-36 rounded-md bg-[var(--bg-hover)] animate-pulse" />
        </div>
        <SkeletonList rows={5} cols={5} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-md bg-[var(--bg-surface)] border border-[var(--border)] p-3">
          <p className="text-[11px] text-[var(--text-faint)] mb-1">Pendentes</p>
          <p className="text-xl font-semibold text-[var(--warn)]">{kpiPendentes ?? '—'}</p>
        </div>
        <div className="rounded-md bg-[var(--bg-surface)] border border-[var(--border)] p-3">
          <p className="text-[11px] text-[var(--text-faint)] mb-1">Aprovadas</p>
          <p className="text-xl font-semibold text-[var(--ok)]">{kpiAprovadas ?? '—'}</p>
        </div>
        <div className="rounded-md bg-[var(--bg-surface)] border border-[var(--border)] p-3">
          <p className="text-[11px] text-[var(--text-faint)] mb-1">Concluídas</p>
          <p className="text-xl font-semibold text-[var(--text-high)]">{kpiConcluidas ?? '—'}</p>
        </div>
        <div className="rounded-md bg-[var(--bg-surface)] border border-[var(--border)] p-3">
          <p className="text-[11px] text-[var(--text-faint)] mb-1">NCs Abertas</p>
          <p className="text-xl font-semibold text-[var(--nc)]">—</p>
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Inspeções</h1>
        <button
          onClick={() => navigate('/fvs/fichas/nova')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          Nova Inspeção
        </button>
      </div>

      {fichas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[var(--text-faint)] text-sm">Nenhuma inspeção encontrada. Crie a primeira!</p>
        </div>
      ) : (
        <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                {['Nome', 'Regime', 'Status', 'Progresso', ''].map(col => (
                  <th key={col} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fichas.map((f, i) => {
                const st = STATUS_LABEL[f.status] ?? { label: f.status, cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)]' };
                return (
                  <tr
                    key={f.id}
                    className={cn(
                      'border-b border-[var(--border-dim)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors',
                      i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                    )}
                  >
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={() => navigate(`/fvs/fichas/${f.id}`)}
                        className="text-[var(--accent)] hover:underline text-left"
                      >
                        {f.nome}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-mid)]">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-faint)]">
                        {REGIME_LABEL[f.regime] ?? f.regime}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', st.cls)}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[var(--border-dim)] rounded-full h-1.5">
                          <div
                            className="bg-[var(--ok-text)] h-full rounded-full transition-all"
                            style={{ width: `${f.progresso ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--text-faint)] w-8 text-right">{f.progresso ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => navigate(`/fvs/fichas/${f.id}`)}
                          className="text-xs px-2.5 py-1 rounded border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          Abrir
                        </button>
                        {f.status === 'rascunho' && (
                          <button
                            onClick={() => { if (confirm(`Excluir "${f.nome}"?`)) deleteFicha.mutate(f.id); }}
                            className="text-xs px-2.5 py-1 rounded border border-[var(--nc-border)] text-[var(--nc-text)] hover:bg-[var(--nc-bg)] transition-colors"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
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
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-[var(--text-faint)]">Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
