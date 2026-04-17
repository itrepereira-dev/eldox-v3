// frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFicha, usePatchFicha, useGerarTokenCliente, useRevogarTokenCliente, useCalcularRisco } from '../hooks/useFichas';
import { useGrade, useBulkInspecao } from '../hooks/useGrade';
import { useSolicitarParecer } from '../hooks/useRo';
import { RoPanel } from '../components/RoPanel';
import { ParecerModal } from '../components/ParecerModal';
import { InspecaoModal } from '../components/InspecaoModal';
import type { StatusGrade } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { ArrowLeft, X, CheckSquare, Download, FileText, Share2, Copy, Check, Trash2, ShieldAlert } from 'lucide-react';
import { RelatorioBotao } from '../../relatorios/components/RelatorioBotao';

const API_FVS = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/fvs' : 'http://localhost:3000/api/v1/fvs';

// ── Configurações visuais ─────────────────────────────────────────────────────

const CELL_CLS: Record<StatusGrade, string> = {
  nc:           'bg-[var(--nc-text)] text-white',
  nc_final:     'bg-red-900 text-white',
  aprovado:     'bg-[var(--ok-text)] text-white',
  liberado:     'bg-yellow-400 text-yellow-900',
  pendente:     'bg-[var(--warn-text)] text-white',
  parcial:      'bg-blue-300 text-blue-900',
  nao_avaliado: 'bg-[var(--border-dim)] text-[var(--text-faint)]',
};

const CELL_ICON: Record<StatusGrade, string> = {
  nc:           '✗',
  nc_final:     '🔒',
  aprovado:     '✓',
  liberado:     '⚡',
  pendente:     '!',
  parcial:      '◐',
  nao_avaliado: '—',
};

const LEGEND: { status: StatusGrade; label: string }[] = [
  { status: 'aprovado',     label: 'Aprovado' },
  { status: 'nc',           label: 'NC' },
  { status: 'nc_final',     label: 'NC Final' },
  { status: 'liberado',     label: 'Liberado c/ Concessão' },
  { status: 'pendente',     label: 'Pendente' },
  { status: 'parcial',      label: 'Parcial' },
  { status: 'nao_avaliado', label: 'Não Avaliado' },
];

function riscoColor(score: number | null | undefined): string {
  if (score == null) return 'var(--text-faint)';
  if (score >= 70) return 'var(--nc-text)';
  if (score >= 40) return 'var(--warn-text)';
  return 'var(--ok-text)';
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FichaGradePage() {
  const { fichaId } = useParams<{ fichaId: string }>();
  const id = Number(fichaId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: ficha } = useFicha(id);
  const { data: grade, isLoading } = useGrade(id);
  const patchFicha       = usePatchFicha(id);
  const solicitarParecer = useSolicitarParecer(id);
  const bulk = useBulkInspecao(id);

  // ── Estado local ───────────────────────────────────────────────────────────
  const [confirmando, setConfirmando]   = useState<'iniciar' | 'concluir' | null>(null);
  const [erroConcluso, setErroConcluso] = useState<{ message: string; itensPendentes?: any[] } | null>(null);
  const [showParecer, setShowParecer]   = useState(false);
  const [erroSolicitacao, setErroSolicitacao] = useState<string | null>(null);
  const [confirmInspecao, setConfirmInspecao] = useState<{ servicoId: number; localId: number; servicoNome?: string; localNome?: string; status: StatusGrade } | null>(null);
  const [inspecao, setInspecao]         = useState<{ servicoId: number; localId: number; servicoNome?: string; localNome?: string } | null>(null);
  const [selecionados, setSelecionados] = useState<{ servicoId: number; localId: number }[]>([]);
  const [bulkErro, setBulkErro]         = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenCopiado, setTokenCopiado]     = useState(false);
  const [tokenGerado, setTokenGerado]       = useState<{ token: string; expires_at: string; url: string } | null>(null);
  const gerarToken   = useGerarTokenCliente(id);
  const revogarToken = useRevogarTokenCliente(id);
  const calcularRisco = useCalcularRisco(id);

  // ── Filtros (URL-synced) ───────────────────────────────────────────────────
  const filtroPavimento = searchParams.get('pavimento') ? Number(searchParams.get('pavimento')) : null;
  const filtroServico   = searchParams.get('servico')   ? Number(searchParams.get('servico'))   : null;
  const filtroStatus    = searchParams.get('status') as StatusGrade | null;

  function setFiltro(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    setSelecionados([]);
  }

  // ── Dados filtrados (client-side) ─────────────────────────────────────────
  const locaisFiltrados = useMemo(() => {
    if (!grade) return [];
    let locs = grade.locais;
    if (filtroPavimento) locs = locs.filter(l => l.pavimento_id === filtroPavimento);
    return locs;
  }, [grade, filtroPavimento]);

  const servicosFiltrados = useMemo(() => {
    if (!grade) return [];
    let srvs = grade.servicos;
    if (filtroServico) srvs = srvs.filter(s => s.id === filtroServico);
    return srvs;
  }, [grade, filtroServico]);

  const pavimentos = useMemo(() => {
    if (!grade) return [];
    const seen = new Map<number, string>();
    grade.locais.forEach(l => { if (l.pavimento_id) seen.set(l.pavimento_id, l.pavimento_nome ?? `Pav. ${l.pavimento_id}`); });
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome }));
  }, [grade]);

  // Auto-seleciona o primeiro pavimento quando a grade tem muitos locais (>30)
  // evita tabela horizontal gigantesca em obras grandes
  useEffect(() => {
    if (!grade || filtroPavimento || searchParams.get('pavimento')) return;
    if (grade.locais.length > 30 && pavimentos.length > 0) {
      setFiltro('pavimento', String(pavimentos[0].id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade?.locais.length, pavimentos.length]);

  function isCelulaVisivel(srvId: number, locId: number): boolean {
    if (!filtroStatus) return true;
    const status = grade?.celulas[srvId]?.[locId] ?? 'nao_avaliado';
    return status === filtroStatus;
  }

  function isLocalVisivel(locId: number): boolean {
    if (!filtroStatus || !grade) return true;
    return servicosFiltrados.some(srv => (grade.celulas[srv.id]?.[locId] ?? 'nao_avaliado') === filtroStatus);
  }

  const locaisVisiveis = useMemo(
    () => locaisFiltrados.filter(l => isLocalVisivel(l.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locaisFiltrados, filtroStatus, servicosFiltrados, grade],
  );

  // ── Grupos por pavimento (para cabeçalho agrupado) ────────────────────────
  const gruposPavimento = useMemo(() => {
    const grupos: { pavNome: string | null; locais: typeof locaisVisiveis }[] = [];
    for (const loc of locaisVisiveis) {
      const last = grupos[grupos.length - 1];
      if (!last || last.pavNome !== loc.pavimento_nome) {
        grupos.push({ pavNome: loc.pavimento_nome, locais: [loc] });
      } else {
        last.locais.push(loc);
      }
    }
    return grupos;
  }, [locaisVisiveis]);

  const temAgrupamento = gruposPavimento.length > 1 || !!gruposPavimento[0]?.pavNome;

  // ── Seleção ────────────────────────────────────────────────────────────────
  function toggleLocalSelecionado(localId: number) {
    const células = servicosFiltrados.map(s => ({ servicoId: s.id, localId }));
    const todasSelecionadas = células.every(c => selecionados.some(s => s.servicoId === c.servicoId && s.localId === c.localId));
    if (todasSelecionadas) {
      setSelecionados(prev => prev.filter(s => s.localId !== localId));
    } else {
      setSelecionados(prev => {
        const filtered = prev.filter(s => s.localId !== localId);
        return [...filtered, ...células];
      });
    }
  }

  function toggleServicoSelecionado(servicoId: number) {
    const células = locaisVisiveis.map(l => ({ servicoId, localId: l.id }));
    const todasSelecionadas = células.every(c => selecionados.some(s => s.servicoId === c.servicoId && s.localId === c.localId));
    if (todasSelecionadas) {
      setSelecionados(prev => prev.filter(s => s.servicoId !== servicoId));
    } else {
      setSelecionados(prev => {
        const filtered = prev.filter(s => s.servicoId !== servicoId);
        return [...filtered, ...células];
      });
    }
  }

  async function handleBulk(status: 'conforme' | 'excecao') {
    setBulkErro(null);
    const porServico = new Map<number, number[]>();
    selecionados.forEach(({ servicoId, localId }) => {
      if (!porServico.has(servicoId)) porServico.set(servicoId, []);
      porServico.get(servicoId)!.push(localId);
    });
    try {
      for (const [servicoId, localIds] of porServico) {
        await bulk.mutateAsync({ servicoId, localIds, status });
      }
      setSelecionados([]);
    } catch (e: any) {
      setBulkErro(e?.response?.data?.message ?? 'Erro ao inspecionar em massa');
    }
  }

  // ── Status change ──────────────────────────────────────────────────────────
  async function handleStatusChange(novoStatus: 'em_inspecao' | 'concluida') {
    setErroConcluso(null);
    try {
      await patchFicha.mutateAsync({ status: novoStatus });
      setConfirmando(null);
    } catch (e: any) {
      const data = e?.response?.data;
      setErroConcluso({ message: data?.message ?? 'Erro ao alterar status', itensPendentes: data?.itensPendentes });
    }
  }

  async function handleSolicitarParecer() {
    setErroSolicitacao(null);
    try { await solicitarParecer.mutateAsync(); }
    catch (e: any) { setErroSolicitacao(e?.response?.data?.message ?? 'Erro ao solicitar parecer.'); }
  }

  async function handleGerarToken() {
    const result = await gerarToken.mutateAsync(undefined);
    setTokenGerado(result);
  }

  async function handleCopiarLink() {
    const url = `${window.location.origin}/fvs-cliente/${tokenGerado?.token ?? (ficha as any).token_cliente}`;
    await navigator.clipboard.writeText(url);
    setTokenCopiado(true);
    setTimeout(() => setTokenCopiado(false), 2000);
  }

  const canClick  = ficha?.status === 'em_inspecao';
  const canSelect = ficha?.status === 'em_inspecao' && !filtroStatus;

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading || !grade || !ficha) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  const progresso = grade.resumo?.progresso_pct ?? 0;

  return (
    <div className="p-6">
      {/* Cabeçalho + Progresso */}
      <div className="flex items-start gap-3 mb-4">
        <button
          onClick={() => navigate('/fvs/fichas')}
          className="mt-0.5 p-1.5 rounded-md text-[var(--text-faint)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-high)] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-[var(--text-high)] m-0 mb-0.5">{ficha.nome}</h2>
          <p className="text-xs text-[var(--text-faint)] m-0">
            {ficha.regime.toUpperCase()} · {ficha.status.replace(/_/g, ' ')}
          </p>
          {/* Barra de progresso */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-[var(--border-dim)] rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full bg-[var(--ok-text)] rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="text-xs text-[var(--text-faint)] font-mono">
              {progresso}% aprovadas ({grade.resumo?.aprovadas ?? 0}/{grade.resumo?.total_celulas ?? 0})
            </span>
          </div>
          {ficha.risco_score != null && (
            <div className="mt-1 flex items-center gap-1.5">
              <ShieldAlert size={12} style={{ color: riscoColor(ficha.risco_score) }} />
              <span className="text-xs font-mono" style={{ color: riscoColor(ficha.risco_score) }}>
                Risco: {ficha.risco_score}/100
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Ações de ciclo */}
      <div className="flex gap-2 flex-wrap items-center mb-4">
        {ficha.status === 'rascunho' && (
          <button onClick={() => setConfirmando('iniciar')} className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity">
            Iniciar Inspeção
          </button>
        )}
        {ficha.status === 'em_inspecao' && (
          <button onClick={() => setConfirmando('concluir')} className="px-4 py-2 text-sm rounded-md bg-[var(--ok-text)] text-white font-medium hover:opacity-90 transition-opacity">
            Concluir Ficha
          </button>
        )}
        {ficha.status === 'concluida' && (
          <button onClick={handleSolicitarParecer} disabled={solicitarParecer.isPending} className="px-4 py-2 text-sm rounded-md bg-[var(--warn-text)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {solicitarParecer.isPending ? 'Solicitando...' : 'Solicitar Parecer'}
          </button>
        )}
        {ficha.status === 'aguardando_parecer' && (
          <button onClick={() => setShowParecer(true)} className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white font-medium hover:opacity-90 transition-opacity">
            Emitir Parecer
          </button>
        )}
        {ficha.status === 'aprovada' && (
          <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]">
            ✓ Ficha Aprovada
          </span>
        )}

        {/* PDF — disponível em qualquer status (exceto rascunho) */}
        {ficha.status !== 'rascunho' && (
          <>
            <a
              href={`${API_FVS}/fichas/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-high)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Baixar PDF completo"
            >
              <Download size={14} />
              PDF
            </a>
            <a
              href={`${API_FVS}/fichas/${id}/pdf?apenasNc=true`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-high)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Baixar PDF somente NCs"
            >
              <FileText size={14} />
              PDF (NCs)
            </a>
          </>
        )}

        {ficha.status !== 'rascunho' && (
          <button
            onClick={() => calcularRisco.mutate()}
            disabled={calcularRisco.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-high)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            title="Calcular risco com IA"
          >
            <ShieldAlert size={14} />
            {calcularRisco.isPending ? 'Calculando...' : 'Calcular Risco'}
          </button>
        )}

        {(ficha.status === 'concluida' || ficha.status === 'aprovada') && (
          <button
            onClick={() => setShowTokenModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-high)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Compartilhar com cliente"
          >
            <Share2 size={14} />
            Compartilhar
          </button>
        )}

        <RelatorioBotao
          tipo="R1_FICHA"
          filtros={{ fichaId: id, obraId: ficha.obra_id }}
          formatos={['pdf']}
          label="Exportar Ficha PDF"
        />
        <RelatorioBotao
          tipo="R2_CONFORMIDADE"
          filtros={{ obraId: ficha.obra_id }}
          formatos={['pdf', 'excel']}
          label="Conformidade"
        />
      </div>

      {erroSolicitacao && (
        <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-4">{erroSolicitacao}</p>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-dim)]">
        <select
          value={filtroPavimento ?? ''}
          onChange={e => setFiltro('pavimento', e.target.value || null)}
          className="px-2 py-1.5 text-xs rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todos os Pavimentos</option>
          {pavimentos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>

        <select
          value={filtroServico ?? ''}
          onChange={e => setFiltro('servico', e.target.value || null)}
          className="px-2 py-1.5 text-xs rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todos os Serviços</option>
          {grade.servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>

        <select
          value={filtroStatus ?? ''}
          onChange={e => setFiltro('status', e.target.value || null)}
          className="px-2 py-1.5 text-xs rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todos os Status</option>
          {LEGEND.map(l => <option key={l.status} value={l.status}>{l.label}</option>)}
        </select>

        {(filtroPavimento || filtroServico || filtroStatus) && (
          <button
            onClick={() => { setFiltro('pavimento', null); setFiltro('servico', null); setFiltro('status', null); }}
            className="px-2 py-1.5 text-xs rounded-md text-[var(--text-faint)] hover:text-[var(--text-high)] border border-[var(--border-dim)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Grade */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-auto mb-4">
        <table className="border-collapse text-sm">
          <thead>
            {temAgrupamento && (
              <tr className="bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
                <th />
                {gruposPavimento.map((grupo, gi) => (
                  <th
                    key={gi}
                    colSpan={grupo.locais.length}
                    className="text-center px-3 py-1.5 text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest border-l border-[var(--border-dim)] first:border-l-0"
                  >
                    {grupo.pavNome ?? 'Sem Pavimento'}
                  </th>
                ))}
              </tr>
            )}
            <tr className="bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
              <th className="text-left px-4 py-2.5 min-w-[200px] text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                Serviço
              </th>
              {locaisVisiveis.map(loc => (
                <th
                  key={loc.id}
                  onClick={() => canSelect && toggleLocalSelecionado(loc.id)}
                  className={cn(
                    'px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide whitespace-nowrap max-w-[90px] overflow-hidden text-ellipsis',
                    canSelect ? 'cursor-pointer hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] transition-colors' : '',
                    selecionados.some(s => s.localId === loc.id) ? 'text-[var(--accent)] bg-[var(--accent-subtle,#eff6ff)]' : '',
                  )}
                >
                  {loc.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servicosFiltrados.map((srv, i) => (
              <tr
                key={srv.id}
                className={cn('border-b border-[var(--border-dim)] last:border-0', i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]')}
              >
                <td
                  onClick={() => canSelect && toggleServicoSelecionado(srv.id)}
                  className={cn(
                    'px-4 py-2.5 font-medium',
                    canSelect ? 'cursor-pointer hover:text-[var(--accent)] transition-colors' : '',
                    selecionados.some(s => s.servicoId === srv.id) ? 'text-[var(--accent)]' : 'text-[var(--text-high)]',
                  )}
                >
                  {srv.nome}
                </td>
                {locaisVisiveis.map(loc => {
                  const status: StatusGrade = grade.celulas[srv.id]?.[loc.id] ?? 'nao_avaliado';
                  if (!isCelulaVisivel(srv.id, loc.id)) {
                    return <td key={loc.id} className="px-3 py-2 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-md opacity-10 bg-[var(--border-dim)]">—</span></td>;
                  }
                  const isSelected = selecionados.some(s => s.servicoId === srv.id && s.localId === loc.id);
                  return (
                    <td key={loc.id} className="px-3 py-2 text-center">
                      <span
                        onClick={() => {
                          if (canClick) {
                            setConfirmInspecao({ servicoId: srv.id, localId: loc.id, servicoNome: srv.nome, localNome: loc.nome, status });
                          }
                        }}
                        title={`${srv.nome} — ${loc.nome}: ${status}`}
                        className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold transition-all',
                          CELL_CLS[status],
                          canClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                          ficha.status === 'rascunho' ? 'opacity-40' : '',
                          isSelected ? 'ring-2 ring-[var(--accent)] ring-offset-1' : '',
                        )}
                      >
                        {CELL_ICON[status]}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 mb-6">
        {LEGEND.map(({ status, label }) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <span className={cn('w-3 h-3 rounded-sm inline-block', CELL_CLS[status])} />
            {label}
          </span>
        ))}
      </div>

      {(ficha.status === 'concluida' || ficha.status === 'aguardando_parecer') && (
        <RoPanel fichaId={id} regime={ficha.regime} />
      )}

      {/* Barra flutuante de seleção em massa */}
      {selecionados.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-dim)] shadow-2xl">
          <CheckSquare size={14} className="text-[var(--accent)]" />
          <span className="text-sm font-medium text-[var(--text-high)]">
            {selecionados.length} célula{selecionados.length !== 1 ? 's' : ''} selecionada{selecionados.length !== 1 ? 's' : ''}
          </span>
          <div className="w-px h-4 bg-[var(--border-dim)] mx-1" />
          <button
            onClick={() => handleBulk('conforme')}
            disabled={bulk.isPending}
            className="px-3 py-1 text-xs rounded-md bg-[var(--ok-text)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            ✓ Marcar Conforme
          </button>
          <button
            onClick={() => handleBulk('excecao')}
            disabled={bulk.isPending}
            className="px-3 py-1 text-xs rounded-md bg-[var(--bg-raised)] text-[var(--text-high)] border border-[var(--border-dim)] font-medium hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
          >
            Exceção
          </button>
          {bulkErro && <span className="text-xs text-[var(--nc-text)]">{bulkErro}</span>}
          <button
            onClick={() => setSelecionados([])}
            className="p-1 text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modais */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-[var(--text-high)] mb-2">
              {confirmando === 'iniciar' ? 'Iniciar Inspeção?' : 'Concluir Ficha?'}
            </h3>
            <p className="text-sm text-[var(--text-faint)] mb-4">
              {confirmando === 'iniciar'
                ? 'A ficha será movida para "Em Inspeção". Confirma?'
                : 'A ficha será concluída. Confirma?'}
            </p>
            {erroConcluso && (
              <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-3">
                {erroConcluso.message}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setConfirmando(null); setErroConcluso(null); }}
                className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-faint)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleStatusChange(confirmando === 'iniciar' ? 'em_inspecao' : 'concluida')}
                disabled={patchFicha.isPending}
                className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {patchFicha.isPending ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showParecer && (
        <ParecerModal
          fichaId={id}
          regime={ficha.regime}
          onClose={() => setShowParecer(false)}
          onSuccess={() => setShowParecer(false)}
        />
      )}

      {confirmInspecao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[var(--text-high)] mb-1">
              {confirmInspecao.status === 'nao_avaliado' ? 'Iniciar inspeção?' : 'Retomar inspeção?'}
            </h3>
            <p className="text-sm text-[var(--text-faint)] mb-5">
              <span className="font-medium text-[var(--text-high)]">{confirmInspecao.servicoNome}</span>
              {' — '}
              {confirmInspecao.localNome}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmInspecao(null)}
                className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-faint)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Não
              </button>
              <button
                onClick={() => {
                  const { status: _s, ...rest } = confirmInspecao;
                  setInspecao(rest);
                  setConfirmInspecao(null);
                }}
                className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {inspecao && (
        <InspecaoModal
          fichaId={id}
          servicoId={inspecao.servicoId}
          localId={inspecao.localId}
          servicoNome={inspecao.servicoNome}
          localNome={inspecao.localNome}
          onClose={() => setInspecao(null)}
        />
      )}

      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text-high)]">Compartilhar com Cliente</h3>
              <button onClick={() => { setShowTokenModal(false); setTokenGerado(null); }} className="p-1 text-[var(--text-faint)] hover:text-[var(--text-high)]"><X size={16} /></button>
            </div>

            {!(tokenGerado || (ficha as any).token_cliente) ? (
              <div className="space-y-4">
                <p className="text-sm text-[var(--text-faint)]">Gere um link seguro para o cliente visualizar o relatório de inspeção.</p>
                <button
                  onClick={handleGerarToken}
                  disabled={gerarToken.isPending}
                  className="w-full px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {gerarToken.isPending ? 'Gerando...' : 'Gerar Link'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-faint)]">Link de acesso do cliente (válido por 30 dias):</p>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-dim)]">
                  <code className="flex-1 text-xs text-[var(--text-high)] truncate">
                    {`${window.location.origin}/fvs-cliente/${tokenGerado?.token ?? (ficha as any).token_cliente}`}
                  </code>
                  <button
                    onClick={handleCopiarLink}
                    className="flex-shrink-0 p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                    title="Copiar link"
                  >
                    {tokenCopiado ? <Check size={14} className="text-[var(--ok-text)]" /> : <Copy size={14} className="text-[var(--text-faint)]" />}
                  </button>
                </div>
                {tokenCopiado && <p className="text-xs text-[var(--ok-text)]">Link copiado!</p>}
                <div className="pt-2 border-t border-[var(--border-dim)]">
                  <button
                    onClick={async () => { await revogarToken.mutateAsync(); setTokenGerado(null); setShowTokenModal(false); }}
                    disabled={revogarToken.isPending}
                    className="flex items-center gap-1.5 text-xs text-[var(--nc-text)] hover:underline disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {revogarToken.isPending ? 'Revogando...' : 'Revogar acesso'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
