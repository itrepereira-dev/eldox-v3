// frontend-web/src/modules/fvm/fornecedores/pages/FornecedoresPage.tsx
// Listagem de fornecedores com score e situação — requisito PBQP-H §2.5

import { useState } from 'react';
import { Plus, Search, Star, Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFornecedores } from '../../grade/hooks/useGradeFvm';
import type { SituacaoFornecedor } from '@/services/fvm.service';
import { FornecedorModal } from '../components/FornecedorModal';

// ── Status badges ──────────────────────────────────────────────────────────────

const SITUACAO_CLS: Record<SituacaoFornecedor, string> = {
  em_avaliacao:   'bg-blue-100 text-blue-700 border border-blue-200',
  homologado:     'bg-green-100 text-green-700 border border-green-200',
  suspenso:       'bg-yellow-100 text-yellow-700 border border-yellow-200',
  desqualificado: 'bg-red-100 text-red-700 border border-red-200',
};

const SITUACAO_LABEL: Record<SituacaoFornecedor, string> = {
  em_avaliacao:   'Em avaliação',
  homologado:     'Homologado',
  suspenso:       'Suspenso',
  desqualificado: 'Desqualificado',
};

// ── Score visual ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-[var(--text-faint)]">—</span>;
  const cor = score >= 7 ? 'text-green-600' : score >= 5 ? 'text-yellow-600' : 'text-red-600';
  return (
    <span className={cn('flex items-center gap-1 font-mono font-semibold text-sm', cor)}>
      <Star size={11} className="fill-current" />
      {score.toFixed(1)}
    </span>
  );
}

// ── Taxa de aprovação ──────────────────────────────────────────────────────────

function TaxaAprovacao({ total, aprovadas }: { total?: number; aprovadas?: number }) {
  if (!total || total === 0) return <span className="text-xs text-[var(--text-faint)]">—</span>;
  const pct = Math.round(((aprovadas ?? 0) / total) * 100);
  const cor  = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[var(--border-dim)] overflow-hidden">
        <div className={cn('h-full rounded-full', cor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--text-faint)] font-mono">{pct}%</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FornecedoresPage() {
  const [search, setSearch]       = useState('');
  const [situacao, setSituacao]   = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: fornecedores = [], isLoading } = useFornecedores();

  // Filtro client-side (a lista raramente passa de ~100 registros)
  const filtrados = fornecedores.filter(f => {
    const matchSearch = !search ||
      f.razao_social.toLowerCase().includes(search.toLowerCase()) ||
      (f.nome_fantasia ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (f.cnpj ?? '').includes(search);
    const matchSituacao = !situacao || f.situacao === situacao;
    return matchSearch && matchSituacao;
  });

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Fornecedores</h1>
          <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">
            Cadastro e homologação — requisito PBQP-H §2.5
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={15} />
          Novo Fornecedor
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CNPJ…"
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-md text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <select
          value={situacao}
          onChange={e => setSituacao(e.target.value)}
          className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-md px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todas as situações</option>
          {Object.entries(SITUACAO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {([
          { label: 'Total',         value: fornecedores.length,                                           cls: '' },
          { label: 'Homologados',   value: fornecedores.filter(f => f.situacao === 'homologado').length,  cls: 'text-green-600' },
          { label: 'Em avaliação',  value: fornecedores.filter(f => f.situacao === 'em_avaliacao').length,cls: 'text-blue-600' },
          { label: 'Suspensos',     value: fornecedores.filter(f => f.situacao === 'suspenso' || f.situacao === 'desqualificado').length, cls: 'text-red-600' },
        ] as const).map(kpi => (
          <div key={kpi.label} className="border border-[var(--border-dim)] rounded-lg px-4 py-3 bg-[var(--bg-raised)]">
            <p className="text-xs text-[var(--text-faint)]">{kpi.label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', kpi.cls || 'text-[var(--text-high)]')}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
              {['Fornecedor', 'CNPJ', 'Situação', 'Entregas', 'Taxa aprovação', 'Score'].map(col => (
                <th key={col} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-faint)]">
                  Carregando…
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Building2 size={32} className="mx-auto text-[var(--border-dim)] mb-3" />
                  <p className="text-sm text-[var(--text-faint)]">
                    {search || situacao ? 'Nenhum fornecedor encontrado para os filtros.' : 'Nenhum fornecedor cadastrado ainda.'}
                  </p>
                </td>
              </tr>
            ) : (
              filtrados.map((forn, i) => (
                <tr
                  key={forn.id}
                  className={cn(
                    'border-b border-[var(--border-dim)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer',
                    i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-high)]">{forn.razao_social}</div>
                    {forn.nome_fantasia && forn.nome_fantasia !== forn.razao_social && (
                      <div className="text-xs text-[var(--text-faint)] mt-0.5">{forn.nome_fantasia}</div>
                    )}
                    {forn.cidade && (
                      <div className="text-xs text-[var(--text-faint)]">{forn.cidade}{forn.uf ? ` / ${forn.uf}` : ''}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[var(--text-faint)]">
                    {forn.cnpj ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', SITUACAO_CLS[forn.situacao])}>
                      {SITUACAO_LABEL[forn.situacao]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[var(--text-high)]">
                    {forn.total_entregas ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <TaxaAprovacao total={forn.total_entregas} aprovadas={forn.entregas_aprovadas} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={forn.avaliacao_score} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FornecedorModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
