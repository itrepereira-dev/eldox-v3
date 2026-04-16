// frontend-web/src/modules/ensaios/revisoes/pages/RevisoesPage.tsx
// Listagem e Revisão de Laudos de Ensaios — SPEC 3

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FlaskConical, Eye, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EnsaioRevisaoDetalhe } from '@/services/ensaios.service';
import { useListarRevisoes } from '../hooks/useRevisoes';
import { RevisaoModal } from '../components/RevisaoModal';

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabSituacao = 'PENDENTE' | 'APROVADO' | 'REPROVADO' | 'TODOS';

const TABS: { key: TabSituacao; label: string }[] = [
  { key: 'PENDENTE',  label: 'Pendentes'  },
  { key: 'APROVADO',  label: 'Aprovados'  },
  { key: 'REPROVADO', label: 'Reprovados' },
  { key: 'TODOS',     label: 'Todos'      },
];

// ── Helpers de badge ──────────────────────────────────────────────────────────

function SituacaoBadge({ situacao }: { situacao: EnsaioRevisaoDetalhe['situacao'] }) {
  const cls = {
    PENDENTE:  'bg-amber-950/60 text-amber-300 border-amber-800',
    APROVADO:  'bg-emerald-950/60 text-emerald-300 border-emerald-800',
    REPROVADO: 'bg-red-950/60 text-red-300 border-red-800',
  }[situacao];

  const label = { PENDENTE: 'Pendente', APROVADO: 'Aprovado', REPROVADO: 'Reprovado' }[situacao];

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border', cls)}>
      {label}
    </span>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: EnsaioRevisaoDetalhe['prioridade'] }) {
  if (prioridade !== 'alta') return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border bg-red-900/30 text-red-400 border-red-700 animate-pulse">
      ALTA
    </span>
  );
}

// ── Formatação de resultados inline ──────────────────────────────────────────

function ResultadosInline({ resultados }: { resultados: EnsaioRevisaoDetalhe['resultados'] }) {
  if (!resultados || resultados.length === 0) {
    return <span className="text-[var(--text-faint)] text-xs">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {resultados.slice(0, 3).map((r) => {
        const u = r.tipo_unidade ?? '';
        let ref = '—';
        if (r.tipo_valor_ref_min != null && r.tipo_valor_ref_max != null)
          ref = `${r.tipo_valor_ref_min}–${r.tipo_valor_ref_max} ${u}`;
        else if (r.tipo_valor_ref_min != null) ref = `≥ ${r.tipo_valor_ref_min} ${u}`;
        else if (r.tipo_valor_ref_max != null) ref = `≤ ${r.tipo_valor_ref_max} ${u}`;

        return (
          <span key={r.id} className="text-[10px] text-[var(--text-faint)] whitespace-nowrap">
            <span className="text-[var(--text-mid)]">{r.tipo_nome ?? '—'}:</span>{' '}
            <span
              className={cn(
                'font-medium',
                r.aprovado_auto === true
                  ? 'text-emerald-400'
                  : r.aprovado_auto === false
                    ? 'text-red-400'
                    : 'text-[var(--text-faint)]',
              )}
            >
              {r.valor_obtido} {u}
            </span>{' '}
            <span className="text-[var(--text-faint)]">vs {ref}</span>
          </span>
        );
      })}
      {resultados.length > 3 && (
        <span className="text-[10px] text-[var(--text-faint)]">
          +{resultados.length - 3} mais
        </span>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="border-b border-[var(--border-dim)]">
          {[120, 120, 140, 90, 160, 80, 60, 80].map((w, j) => (
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

function EmptyState({ tab }: { tab: TabSituacao }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center mb-4">
        <FlaskConical size={32} className="text-[var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-high)] mb-1">
        {tab === 'PENDENTE'
          ? 'Nenhum laudo pendente de revisão'
          : `Nenhum laudo ${tab === 'TODOS' ? '' : tab.toLowerCase()} encontrado`}
      </h3>
      <p className="text-sm text-[var(--text-faint)] max-w-sm mt-1">
        {tab === 'PENDENTE'
          ? 'Todos os laudos foram revisados. Bom trabalho!'
          : 'Nenhum registro corresponde ao filtro selecionado.'}
      </p>
    </div>
  );
}

// ── Formatação de data ────────────────────────────────────────────────────────

function fmtData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function RevisoesPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const obraIdNum = Number(obraId) || 0;

  const [tab, setTab] = useState<TabSituacao>('PENDENTE');
  const [revisaoSelecionada, setRevisaoSelecionada] =
    useState<EnsaioRevisaoDetalhe | null>(null);

  const queryParams = {
    obra_id: obraIdNum,
    situacao: tab !== 'TODOS' ? (tab as 'PENDENTE' | 'APROVADO' | 'REPROVADO') : undefined,
  };

  const { data, isLoading, isError } = useListarRevisoes(queryParams);
  const revisoes = data?.data ?? [];

  // Contagem de pendentes para badge no tab
  const { data: pendentesData } = useListarRevisoes({
    obra_id: obraIdNum,
    situacao: 'PENDENTE',
  });
  const totalPendentes = pendentesData?.total ?? 0;

  return (
    <div className="p-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">
            Revisão de Laudos
          </h1>
          <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">
            Aprovação e reprovação de laudos laboratoriais por obra
          </p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'relative px-3 py-1.5 text-sm rounded-md transition-all font-medium flex items-center gap-1.5',
                tab === t.key
                  ? 'bg-[var(--bg-raised)] text-[var(--text-high)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-high)]',
              )}
            >
              {t.label}
              {t.key === 'PENDENTE' && totalPendentes > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-900/60 border border-amber-700 text-amber-300 text-[10px] font-semibold">
                  {totalPendentes}
                </span>
              )}
            </button>
          ))}
        </div>

        {!isLoading && (
          <span className="ml-auto text-xs text-[var(--text-faint)]">
            {revisoes.length} {revisoes.length === 1 ? 'registro' : 'registros'}
          </span>
        )}
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────── */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
        {isError ? (
          <div className="flex items-center justify-center py-16 text-center px-6">
            <div>
              <p className="text-sm text-[var(--nc-text)] font-medium">Erro ao carregar laudos</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Tente recarregar a página</p>
            </div>
          </div>
        ) : isLoading || revisoes.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                {[
                  'Material',
                  'Fornecedor',
                  'Laboratório',
                  'Data Ensaio',
                  'Resultados',
                  'Situação',
                  'Prioridade',
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
                revisoes.map((rev, i) => (
                  <tr
                    key={rev.id}
                    className={cn(
                      'border-b border-[var(--border-dim)] transition-colors',
                      i % 2 === 0
                        ? 'bg-[var(--bg-base)]'
                        : 'bg-[var(--bg-surface)]',
                      'hover:bg-[var(--bg-raised)]',
                    )}
                  >
                    {/* Material */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-[var(--text-high)]">
                        {rev.material_nome ?? '—'}
                      </span>
                    </td>

                    {/* Fornecedor */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-faint)]">
                        {rev.fornecedor_nome ?? '—'}
                      </span>
                    </td>

                    {/* Laboratório */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-faint)]">
                        {rev.laboratorio_nome ?? '—'}
                      </span>
                    </td>

                    {/* Data Ensaio */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-[var(--text-mid)]">
                        {fmtData(rev.data_ensaio)}
                      </span>
                    </td>

                    {/* Resultados inline */}
                    <td className="px-4 py-3">
                      <ResultadosInline resultados={rev.resultados} />
                    </td>

                    {/* Situação */}
                    <td className="px-4 py-3">
                      <SituacaoBadge situacao={rev.situacao} />
                    </td>

                    {/* Prioridade */}
                    <td className="px-4 py-3">
                      <PrioridadeBadge prioridade={rev.prioridade} />
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      {rev.situacao === 'PENDENTE' ? (
                        <button
                          type="button"
                          onClick={() => setRevisaoSelecionada(rev)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                        >
                          <ClipboardCheck size={12} />
                          Revisar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRevisaoSelecionada(rev)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-dim)] text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--border-mid)] text-xs font-medium transition-colors whitespace-nowrap"
                        >
                          <Eye size={12} />
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <EmptyState tab={tab} />
        )}
      </div>

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {revisaoSelecionada && (
        <RevisaoModal
          revisao={revisaoSelecionada}
          onClose={() => setRevisaoSelecionada(null)}
        />
      )}
    </div>
  );
}
