import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Columns3, List, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAprovacoes, useContagemPendentes } from '../hooks/useAprovacoes';
import { AprovacaoKanbanCard } from '../components/AprovacaoKanbanCard';
import { AprovacaoStatusBadge, STATUS_CONFIG } from '../components/AprovacaoStatusBadge';
import type { AprovacaoStatus, AprovacaoModulo, AprovacaoInstancia } from '../../../services/aprovacoes.service';

// ── Configurações ─────────────────────────────────────────────────────────────

type ViewMode = 'kanban' | 'lista';

const KANBAN_STATUS: AprovacaoStatus[] = ['PENDENTE', 'EM_APROVACAO', 'APROVADO', 'REPROVADO'];

const MODULO_LABEL: Record<AprovacaoModulo, string> = {
  FVS:          'FVS',
  FVM:          'FVM',
  RDO:          'RDO',
  NC:           'NC',
  GED:          'GED',
  ENSAIO:       'Ensaio',
  CONCRETAGEM:  'Concretagem',
  ALMOXARIFADO: 'Almoxarifado',
};

const STATUS_ALL: AprovacaoStatus[] = ['PENDENTE', 'EM_APROVACAO', 'APROVADO', 'REPROVADO', 'CANCELADO'];


// ── Componente principal ──────────────────────────────────────────────────────

export function AprovacoesPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<AprovacaoStatus | ''>('');
  const [filtroModulo, setFiltroModulo] = useState<AprovacaoModulo | ''>('');

  const { data: aprovacoes = [], isLoading } = useAprovacoes({
    status: filtroStatus || undefined,
    modulo: filtroModulo || undefined,
  });

  const { data: contagem } = useContagemPendentes();

  const filtradas: AprovacaoInstancia[] = (aprovacoes as AprovacaoInstancia[]).filter(a => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      a.titulo.toLowerCase().includes(termo) ||
      a.solicitante?.nome?.toLowerCase().includes(termo) ||
      a.obra?.nome?.toLowerCase().includes(termo)
    );
  });

  // Agrupa por status para kanban
  const kanbanColunas: Record<AprovacaoStatus, AprovacaoInstancia[]> = {
    PENDENTE:     [],
    EM_APROVACAO: [],
    APROVADO:     [],
    REPROVADO:    [],
    CANCELADO:    [],
  };
  for (const a of filtradas) {
    if (kanbanColunas[a.status]) kanbanColunas[a.status].push(a);
  }

  return (
    <div className="p-6" style={{ background: 'var(--bg-void)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 36, height: 36, background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
            >
              <ClipboardCheck size={18} style={{ color: 'var(--warn)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-high)] tracking-tight m-0">
                Central de Aprovações
              </h1>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                {filtradas.length} instância{filtradas.length !== 1 ? 's' : ''}
                {contagem?.total ? ` · ${contagem.total} pendente${contagem.total !== 1 ? 's' : ''} para você` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 mb-5 flex-wrap">
          {/* Busca */}
          <div className="relative flex-1" style={{ maxWidth: 300 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar aprovações..."
              className="w-full pl-8 pr-3 h-9 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Filtro status */}
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as AprovacaoStatus | '')}
            className="h-9 px-3 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            style={{ minWidth: 140 }}
          >
            <option value="">Todos os status</option>
            {STATUS_ALL.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          {/* Filtro módulo */}
          <select
            value={filtroModulo}
            onChange={e => setFiltroModulo(e.target.value as AprovacaoModulo | '')}
            className="h-9 px-3 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            style={{ minWidth: 140 }}
          >
            <option value="">Todos os módulos</option>
            {(Object.entries(MODULO_LABEL) as [AprovacaoModulo, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Badge pendentes para mim */}
          {contagem?.total != null && contagem.total > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: 'var(--warn-bg)',
                color: 'var(--warn-text)',
                border: '1px solid var(--warn-border)',
              }}
            >
              <span
                className="flex items-center justify-center rounded-full text-[10px] font-bold min-w-[18px] h-[18px] px-1"
                style={{ background: 'var(--warn)', color: 'var(--bg-void)' }}
              >
                {contagem.total > 99 ? '99+' : contagem.total}
              </span>
              pendente{contagem.total !== 1 ? 's' : ''} para mim
            </div>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--border-dim)] overflow-hidden bg-[var(--bg-raised)]">
            {([
              { mode: 'kanban', Icon: Columns3, title: 'Kanban' },
              { mode: 'lista',  Icon: List,      title: 'Lista' },
            ] as const).map(({ mode, Icon, title }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={title}
                className={cn(
                  'flex items-center justify-center w-9 h-9 transition-colors',
                  viewMode === mode
                    ? 'bg-[var(--bg-hover)] text-[var(--text-high)]'
                    : 'text-[var(--text-faint)] hover:text-[var(--text-high)]',
                )}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-[var(--text-faint)]">
            Carregando aprovações...
          </div>
        )}

        {/* ── MODO KANBAN ───────────────────────────────────────────────── */}
        {!isLoading && viewMode === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {KANBAN_STATUS.map(status => {
              const cfg = STATUS_CONFIG[status];
              const itens = kanbanColunas[status] ?? [];
              return (
                <div
                  key={status}
                  className="flex-none w-72 rounded-xl border border-[var(--border-dim)] flex flex-col"
                  style={{ borderTop: `3px solid ${cfg.cor}`, maxHeight: 'calc(100vh - 220px)' }}
                >
                  {/* Header coluna */}
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dim)]"
                    style={{ background: cfg.bgCor }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: cfg.cor }}
                      />
                      <span className="text-sm font-semibold" style={{ color: cfg.cor }}>
                        {cfg.label}
                      </span>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: cfg.cor,
                        background: `${cfg.cor}20`,
                        border: `1px solid ${cfg.cor}40`,
                      }}
                    >
                      {itens.length}
                    </span>
                  </div>

                  {/* Cards com scroll */}
                  <div className="flex flex-col gap-2.5 p-3 overflow-y-auto flex-1">
                    {itens.length === 0 && (
                      <div className="py-6 text-center text-xs text-[var(--text-faint)] border border-dashed border-[var(--border-dim)] rounded-lg">
                        Nenhuma aprovação
                      </div>
                    )}
                    {itens.map(item => (
                      <AprovacaoKanbanCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MODO LISTA ────────────────────────────────────────────────── */}
        {!isLoading && viewMode === 'lista' && (
          <>
            {filtradas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border-dim)] rounded-xl">
                <ClipboardCheck size={32} className="text-[var(--border-dim)] mb-3" />
                <p className="text-sm text-[var(--text-faint)]">
                  Nenhuma aprovação encontrada.
                </p>
              </div>
            )}

            {filtradas.length > 0 && (
              <div className="rounded-xl border border-[var(--border-dim)] overflow-hidden">
                {/* Header tabela */}
                <div
                  className="grid text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] px-4 py-2.5 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]"
                  style={{ gridTemplateColumns: '1fr 90px 90px 140px 140px 100px 110px 80px' }}
                >
                  <span>Título</span>
                  <span>Módulo</span>
                  <span>Etapa</span>
                  <span>Solicitante</span>
                  <span>Obra</span>
                  <span>Prazo</span>
                  <span>Status</span>
                  <span className="text-right">Ações</span>
                </div>

                {filtradas.map((a, i) => (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/aprovacoes/${a.id}`)}
                    className={cn(
                      'grid items-center px-4 py-3 border-b border-[var(--border-dim)] last:border-0 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]',
                      i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                    )}
                    style={{ gridTemplateColumns: '1fr 90px 90px 140px 140px 100px 110px 80px' }}
                  >
                    <span className="text-sm font-semibold text-[var(--text-high)] truncate pr-2">
                      {a.titulo}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase w-fit"
                      style={{ background: 'var(--accent-dim,rgba(240,136,62,.12))', color: 'var(--accent)' }}
                    >
                      {MODULO_LABEL[a.modulo] ?? a.modulo}
                    </span>
                    <span className="text-xs text-[var(--text-faint)]">
                      {a.etapaAtual != null ? `Etapa ${a.etapaAtual}` : '—'}
                    </span>
                    <span className="text-xs text-[var(--text-faint)] truncate">
                      {a.solicitante?.nome ?? '—'}
                    </span>
                    <span className="text-xs text-[var(--text-faint)] truncate">
                      {a.obra?.nome ?? '—'}
                    </span>
                    <span className="text-xs text-[var(--text-faint)]">
                      {a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : '—'}
                    </span>
                    <AprovacaoStatusBadge status={a.status} size="sm" />
                    <div className="flex justify-end">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/aprovacoes/${a.id}`); }}
                        className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity font-medium"
                      >
                        Ver →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
