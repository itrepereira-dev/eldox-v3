import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { obrasService, type Obra } from '../../services/obras.service';
import { Search, Grid2x2, List, Columns3, Plus, Building, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { semaforoService, type CorSemaforo } from '../../services/semaforo.service';

// ── Configurações visuais ─────────────────────────────────────────────────────

const STATUS_ORDER = ['PLANEJAMENTO', 'EM_EXECUCAO', 'PARALISADA', 'CONCLUIDA', 'ENTREGUE'];

const STATUS_LABEL: Record<string, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_EXECUCAO:  'Em Execução',
  PARALISADA:   'Paralisada',
  CONCLUIDA:    'Concluída',
  ENTREGUE:     'Entregue',
};

const STATUS_COLOR: Record<string, string> = {
  PLANEJAMENTO: '#6b7280',
  EM_EXECUCAO:  '#22c55e',
  PARALISADA:   '#f59e0b',
  CONCLUIDA:    '#a78bfa',
  ENTREGUE:     '#38bdf8',
};

const STATUS_BG: Record<string, string> = {
  PLANEJAMENTO: 'rgba(107,114,128,0.06)',
  EM_EXECUCAO:  'rgba(34,197,94,0.06)',
  PARALISADA:   'rgba(245,158,11,0.06)',
  CONCLUIDA:    'rgba(167,139,250,0.06)',
  ENTREGUE:     'rgba(56,189,248,0.06)',
};

// Gradientes de capa — estilo mockup
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #1a3a2a, #2d5a3d)',
  'linear-gradient(135deg, #1a2a3a, #2d4a6a)',
  'linear-gradient(135deg, #2a1a2a, #5a2d5a)',
  'linear-gradient(135deg, #3a2a1a, #6a4d2d)',
  'linear-gradient(135deg, #1a3a3a, #2d6a6a)',
  'linear-gradient(135deg, #2a2a1a, #5a5a2d)',
  'linear-gradient(135deg, #3a1a1a, #6a2d2d)',
  'linear-gradient(135deg, #1a1a3a, #2d2d6a)',
];

// ── Página principal ──────────────────────────────────────────────────────────

export function ObrasListPage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [search, setSearch]           = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [confirmRemover, setConfirmRemover] = useState<number | null>(null);
  const [page, setPage]               = useState(1);
  const [viewMode, setViewMode]       = useState<'grid' | 'lista' | 'kanban'>('grid');

  const handleSetFiltro = (s: string) => { setStatusFiltro(s); setPage(1); };

  const { data, isLoading } = useQuery({
    queryKey: ['obras', statusFiltro, page],
    queryFn: () => obrasService.getAll({ status: statusFiltro || undefined, page, limit: 20 }),
    enabled: viewMode !== 'kanban',
  });

  const { data: kanbanData, isLoading: kanbanLoading } = useQuery({
    queryKey: ['obras-kanban'],
    queryFn:  () => obrasService.getAll({ page: 1, limit: 200 }),
    enabled:  viewMode === 'kanban',
  });

  const removerMutation = useMutation({
    mutationFn: (id: number) => obrasService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      queryClient.invalidateQueries({ queryKey: ['obras-kanban'] });
      setConfirmRemover(null);
    },
  });

  const total = (viewMode === 'kanban' ? kanbanData?.total : data?.total) ?? 0;
  const obras: Obra[] = (data?.items ?? []).filter((o: Obra) =>
    !search ||
    o.nome.toLowerCase().includes(search.toLowerCase()) ||
    (o.codigo ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // Kanban
  const kanbanObras = kanbanData?.items ?? [];
  const kanbanColunas: Record<string, Obra[]> = {};
  for (const s of STATUS_ORDER) kanbanColunas[s] = [];
  for (const o of kanbanObras) {
    if (kanbanColunas[o.status]) kanbanColunas[o.status].push(o);
    else kanbanColunas[o.status] = [o];
  }

  return (
    <div className="p-6">
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* ── Cabeçalho ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-high)] tracking-tight m-0">
                Minhas Obras{' '}
                <span className="text-base font-normal text-[var(--text-faint)]">
                  ({total} {total === 1 ? 'obra' : 'obras'})
                </span>
              </h1>
            </div>
            {/* EldoxIA chip */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold font-mono"
              style={{ background: 'var(--accent-dim,rgba(240,136,62,.12))', borderColor: 'rgba(240,136,62,.3)', color: 'var(--accent)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              EldoxIA Ativo
            </span>
          </div>
          <button
            onClick={() => navigate('/obras/nova')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Nova Obra
          </button>
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 mb-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1" style={{ maxWidth: 320 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar obras..."
              className="w-full pl-8 pr-3 h-9 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFiltro}
            onChange={e => handleSetFiltro(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            style={{ minWidth: 160 }}
          >
            <option value="">Todas as obras</option>
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--border-dim)] overflow-hidden bg-[var(--bg-raised)]">
            {([
              { mode: 'grid',   Icon: Grid2x2,  title: 'Grade' },
              { mode: 'lista',  Icon: List,      title: 'Lista' },
              { mode: 'kanban', Icon: Columns3,  title: 'Kanban' },
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

        {/* ── MODO GRADE ───────────────────────────────────────────────── */}
        {viewMode === 'grid' && (
          <>
            {isLoading && (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {[1,2,3,4].map(i => (
                  <div key={i} className="rounded-xl border border-[var(--border-dim)] overflow-hidden animate-pulse">
                    <div className="h-36 bg-[var(--bg-raised)]" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-[var(--bg-raised)] rounded w-3/4" />
                      <div className="h-3 bg-[var(--bg-raised)] rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && obras.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border-dim)] rounded-xl">
                <Building size={32} className="text-[var(--border-dim)] mb-3" />
                <p className="text-sm text-[var(--text-faint)] mb-3">
                  {search || statusFiltro ? 'Nenhuma obra encontrada para os filtros.' : 'Nenhuma obra cadastrada ainda.'}
                </p>
                {!search && !statusFiltro && (
                  <button
                    onClick={() => navigate('/obras/nova')}
                    className="text-sm text-[var(--accent)] border border-[var(--accent)] rounded-lg px-4 py-1.5 hover:bg-[var(--accent-dim,rgba(240,136,62,.1))] transition-colors"
                  >
                    Cadastrar obra
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {obras.map((obra) => (
                <ObraCard
                  key={obra.id}
                  obra={obra}
                  onVer={() => navigate(`/obras/${obra.id}`)}
                  onRemover={() => setConfirmRemover(obra.id)}
                />
              ))}
            </div>

            <Paginacao data={data} page={page} setPage={setPage} />
          </>
        )}

        {/* ── MODO LISTA ───────────────────────────────────────────────── */}
        {viewMode === 'lista' && (
          <>
            {isLoading && (
              <div className="text-center py-12 text-sm text-[var(--text-faint)]">Carregando obras...</div>
            )}
            {!isLoading && obras.length === 0 && (
              <div className="text-center py-12 text-sm text-[var(--text-faint)]">Nenhuma obra encontrada</div>
            )}
            {!isLoading && obras.length > 0 && (
              <div className="rounded-xl border border-[var(--border-dim)] overflow-hidden">
                <div className="grid text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] px-4 py-2.5 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]"
                  style={{ gridTemplateColumns: '110px 1fr 150px 130px 140px 70px 40px' }}>
                  <span>Código</span><span>Nome / Tipo</span><span>Status</span>
                  <span>Localização</span><span>Prazo</span>
                  <span className="text-right">Locais</span><span />
                </div>
                {obras.map((obra) => {
                  const cor = STATUS_COLOR[obra.status] ?? '#6b7280';
                  return (
                    <div
                      key={obra.id}
                      onClick={() => navigate(`/obras/${obra.id}`)}
                      className="grid items-center px-4 py-3 border-b border-[var(--border-dim)] last:border-0 cursor-pointer transition-colors hover:bg-[var(--bg-raised)]"
                      style={{ gridTemplateColumns: '110px 1fr 150px 130px 140px 70px 40px', borderLeft: `3px solid ${cor}` }}
                    >
                      <span className="text-xs font-mono text-[var(--text-faint)]">{obra.codigo}</span>
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-high)]">{obra.nome}</div>
                        <div className="text-xs text-[var(--text-faint)] mt-0.5">{obra.obraTipo.nome}</div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full w-fit"
                        style={{ color: cor, background: `${cor}18`, border: `1px solid ${cor}35` }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cor }} />
                        {STATUS_LABEL[obra.status] ?? obra.status}
                      </span>
                      <span className="text-sm text-[var(--text-faint)]">
                        {[obra.cidade, obra.estado].filter(Boolean).join(', ') || '—'}
                      </span>
                      <span className="text-xs text-[var(--text-faint)]">
                        {obra.dataFimPrevista ? new Date(obra.dataFimPrevista).toLocaleDateString('pt-BR') : '—'}
                      </span>
                      <span className="text-sm text-[var(--text-faint)] text-right">{obra.totalLocais.toLocaleString('pt-BR')}</span>
                      <div className="flex justify-center">
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmRemover(obra.id); }}
                          className="text-lg text-[var(--text-faint)] opacity-40 hover:opacity-100 transition-opacity px-1"
                        >×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Paginacao data={data} page={page} setPage={setPage} />
          </>
        )}

        {/* ── MODO KANBAN ──────────────────────────────────────────────── */}
        {viewMode === 'kanban' && (
          <>
            {kanbanLoading && (
              <div className="text-center py-12 text-sm text-[var(--text-faint)]">Carregando obras...</div>
            )}
            {!kanbanLoading && (
              <div className="flex gap-4 overflow-x-auto pb-4 items-start">
                {STATUS_ORDER.map(status => {
                  const cor = STATUS_COLOR[status];
                  const itens = kanbanColunas[status] ?? [];
                  return (
                    <div key={status} className="flex-none w-72 rounded-xl border border-[var(--border-dim)] flex flex-col"
                      style={{ borderTop: `3px solid ${cor}`, maxHeight: 'calc(100vh - 220px)' }}>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dim)]"
                        style={{ background: STATUS_BG[status] }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
                          <span className="text-sm font-semibold" style={{ color: cor }}>{STATUS_LABEL[status]}</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: cor, background: `${cor}20`, border: `1px solid ${cor}40` }}>
                          {itens.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2.5 p-3 overflow-y-auto flex-1">
                        {itens.length === 0 && (
                          <div className="py-6 text-center text-xs text-[var(--text-faint)] border border-dashed border-[var(--border-dim)] rounded-lg">
                            Nenhuma obra
                          </div>
                        )}
                        {itens.map(obra => (
                          <KanbanCard key={obra.id} obra={obra} cor={cor}
                            onVer={() => navigate(`/obras/${obra.id}`)}
                            onRemover={() => setConfirmRemover(obra.id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Modal confirmação de remoção ──────────────────────────────── */}
      {confirmRemover !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-xl p-8 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-[var(--text-high)] mb-2">Remover obra?</h3>
            <p className="text-sm text-[var(--text-faint)] mb-6">
              A obra e todos os locais associados serão arquivados. Esta ação pode ser desfeita pelo administrador.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmRemover(null)}
                className="px-4 py-2 rounded-lg border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => removerMutation.mutate(confirmRemover)}
                disabled={removerMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                {removerMutation.isPending ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card modo Grade — design mockup ─────────────────────────────────────────

function calcPrazo(dataInicio?: string, dataFim?: string): {
  show: boolean; pct: number; cor: string; texto: string;
} {
  if (!dataInicio || !dataFim) return { show: false, pct: 0, cor: '', texto: '' };
  const hoje = Date.now();
  const inicio = new Date(dataInicio).getTime();
  const fim = new Date(dataFim).getTime();
  const total = fim - inicio;
  if (total <= 0) return { show: false, pct: 0, cor: '', texto: '' };
  const pct = ((hoje - inicio) / total) * 100;
  const diasRestantes = Math.ceil((fim - hoje) / 86_400_000);
  if (pct < 0) return { show: true, pct: 0, cor: 'var(--accent)', texto: 'Não iniciada' };
  const cor =
    pct >= 100 ? '#f85149' :
    pct >= 80  ? '#fbbf24' :
                 'var(--accent)';
  const texto = diasRestantes <= 0 ? 'Prazo vencido' : `${diasRestantes}d restantes`;
  return { show: true, pct: Math.min(pct, 100), cor, texto };
}

function ObraCard({ obra, onVer, onRemover }: {
  obra: Obra; onVer: () => void; onRemover: () => void;
}) {
  const gradient = CARD_GRADIENTS[obra.id % CARD_GRADIENTS.length];
  const prazo = calcPrazo(obra.dataInicioPrevista, obra.dataFimPrevista);
  const [imgError, setImgError] = useState(false);
  const usarFoto = !!obra.fotoCapaUrl && !imgError;

  const badgeCls: Record<string, string> = {
    EM_EXECUCAO:  'bg-green-500/20 text-green-400 border border-green-500/40',
    PARALISADA:   'bg-red-500/20 text-red-400 border border-red-500/40',
    CONCLUIDA:    'bg-blue-400/20 text-blue-300 border border-blue-400/40',
    ENTREGUE:     'bg-sky-400/20 text-sky-300 border border-sky-400/40',
    PLANEJAMENTO: 'bg-gray-500/20 text-gray-300 border border-gray-500/40',
  };

  return (
    <div
      className="rounded-xl border border-[var(--border-dim)] overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
      style={{ background: 'var(--bg-raised)' }}
      onClick={onVer}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,.3)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-dim)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Capa */}
      <div className="relative h-[130px] overflow-hidden" style={{ background: gradient }}>
        {usarFoto ? (
          <img
            src={obra.fotoCapaUrl!}
            alt={obra.nome}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/10">
            <Building size={56} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.1) 0%, rgba(0,0,0,.55) 100%)' }} />
        <span className={cn('absolute top-2.5 left-2.5 text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider', badgeCls[obra.status] ?? badgeCls.PLANEJAMENTO)}>
          {STATUS_LABEL[obra.status]}
        </span>
        {obra.modoQualidade === 'PBQPH' && (
          <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40">
            PBQP-H
          </span>
        )}
        <span className="absolute bottom-2 right-2.5 text-[10px] font-mono text-white/50">
          {obra.codigo}
        </span>
      </div>

      {/* Corpo */}
      <div className="p-3 pb-3.5">
        <div className="font-semibold text-[13.5px] text-[var(--text-high)] leading-snug mb-1 line-clamp-2">
          {obra.nome}
        </div>

        {(obra.cidade || obra.estado) && (
          <div className="flex items-center gap-1 text-[11.5px] text-[var(--text-faint)] mb-2.5">
            <MapPin size={10} className="shrink-0" />
            {[obra.cidade, obra.estado].filter(Boolean).join(' / ')}
          </div>
        )}

        {/* Counters */}
        <div className="grid grid-cols-3 gap-1 mb-2.5 p-2 rounded-lg bg-black/20">
          {[
            { num: obra.totalInspecoes ?? 0, lbl: 'Inspeções' },
            { num: obra.totalFotos ?? 0,     lbl: 'Fotos' },
            { num: obra.totalLocais ?? 0,    lbl: 'Locais' },
          ].map(({ num, lbl }) => (
            <div key={lbl} className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold text-[var(--text-high)] leading-none">{num.toLocaleString('pt-BR')}</span>
              <span className="text-[9.5px] uppercase tracking-wide text-[var(--text-faint)]">{lbl}</span>
            </div>
          ))}
        </div>

        {/* Barra de prazo */}
        {prazo.show && (
          <div className="mb-2.5">
            <div className="flex justify-between text-[11px] text-[var(--text-faint)] mb-1">
              <span className="text-[var(--text-high)] font-medium">
                {obra.dataInicioPrevista
                  ? `Início ${new Date(obra.dataInicioPrevista).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`
                  : ''}
              </span>
              <span style={{ color: prazo.cor }}>{prazo.texto}</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--bg-hover)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${prazo.pct}%`, background: prazo.cor }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-faint)] pt-2.5 mt-1 border-t border-[var(--border-dim)]">
          <span className="truncate">{obra.obraTipo.nome}</span>
          {obra.modoQualidade === 'PBQPH' && (
            <SemaforoBadge obraId={obra.id} />
          )}
          <button
            onClick={e => { e.stopPropagation(); onRemover(); }}
            className="ml-auto text-base text-[var(--text-faint)] opacity-30 hover:opacity-100 hover:text-red-500 transition-all px-1"
            title="Remover"
          >×</button>
        </div>
      </div>
    </div>
  );
}

// ── Card compacto para Kanban ─────────────────────────────────────────────────

function KanbanCard({ obra, cor, onVer, onRemover }: {
  obra: Obra; cor: string; onVer: () => void; onRemover: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-[var(--border-dim)] p-3 cursor-pointer transition-shadow hover:shadow-md"
      style={{ background: 'var(--bg-raised)', borderLeft: `3px solid ${cor}` }}
      onClick={onVer}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-mono text-[var(--text-faint)] mb-1">{obra.codigo}</div>
          <div className="text-sm font-semibold text-[var(--text-high)] truncate">{obra.nome}</div>
          <div className="text-xs text-[var(--text-faint)] mt-0.5 truncate">{obra.obraTipo.nome}</div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRemover(); }}
          className="text-base text-[var(--text-faint)] opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
        >×</button>
      </div>
      {(obra.cidade || obra.estado) && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-faint)] mt-2">
          <MapPin size={9} />
          {[obra.cidade, obra.estado].filter(Boolean).join(', ')}
        </div>
      )}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[var(--border-dim)]">
        <span className="text-[11px] text-[var(--text-faint)]">{obra.totalLocais.toLocaleString('pt-BR')} locais</span>
        {obra.modoQualidade === 'PBQPH' && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
            style={{ background: 'var(--accent-dim,rgba(240,136,62,.12))', color: 'var(--accent)' }}>
            PBQP-H
          </span>
        )}
      </div>
    </div>
  );
}

// ── Badge de Semáforo — exibido nos cards de obras PBQP-H ────────────────────

const SEMAFORO_COR: Record<CorSemaforo, { hex: string; label: string }> = {
  verde:    { hex: '#22c55e', label: 'Conforme'     },
  amarelo:  { hex: '#f59e0b', label: 'Atenção'      },
  vermelho: { hex: '#ef4444', label: 'Não Conforme' },
};

function SemaforoBadge({ obraId }: { obraId: number }) {
  const { data } = useQuery({
    queryKey: ['semaforo', obraId],
    queryFn:  () => semaforoService.getObra(obraId),
    staleTime: 60_000,
    enabled:   !!obraId,
  });

  if (!data?.data) return null;

  const { cor, score } = data.data;
  const cfg = SEMAFORO_COR[cor];

  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: `${cfg.hex}20`, color: cfg.hex, border: `1px solid ${cfg.hex}40` }}
      title={`Semáforo PBQP-H: ${cfg.label} (${(score * 100).toFixed(1)}%)`}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.hex }} />
      {(score * 100).toFixed(0)}%
    </span>
  );
}

// ── Paginação ─────────────────────────────────────────────────────────────────

function Paginacao({ data, page, setPage }: {
  data: { totalPages?: number } | undefined;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  if (!data || (data.totalPages ?? 1) <= 1) return null;
  const total = data.totalPages ?? 1;
  return (
    <div className="flex items-center justify-center gap-3 mt-6">
      <button
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        className="px-4 py-1.5 rounded-lg border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] disabled:opacity-40 transition-colors"
      >← Anterior</button>
      <span className="text-sm text-[var(--text-faint)]">Página {page} de {total}</span>
      <button
        onClick={() => setPage(p => Math.min(total, p + 1))}
        disabled={page === total}
        className="px-4 py-1.5 rounded-lg border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] disabled:opacity-40 transition-colors"
      >Próxima →</button>
    </div>
  );
}
