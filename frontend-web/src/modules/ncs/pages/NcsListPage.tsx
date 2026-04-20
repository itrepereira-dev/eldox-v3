// frontend-web/src/modules/ncs/pages/NcsListPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useNcsPorObra, useDeleteNc, useCreateNc } from '../hooks/useNcs';
import type { NaoConformidade, NcStatus, NcCategoria, NcCriticidade } from '../../../services/ncs.service';
import { RelatorioBotao } from '../../fvs/relatorios/components/RelatorioBotao';
import { gedService, type GedDocumento } from '../../../services/ged.service';

// ─── Badges de Status ─────────────────────────────────────────────────────────

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

const CATEGORIA_LABEL: Record<NcCategoria, string> = {
  CONCRETAGEM: 'Concretagem',
  FVS: 'FVS',
  FVM: 'FVM',
  ENSAIO: 'Ensaio',
  GERAL: 'Geral',
};

// ─── Modal de nova NC ─────────────────────────────────────────────────────────

interface NovaNCModalProps {
  obraId: number;
  onClose: () => void;
}

function NovaNCModal({ obraId, onClose }: NovaNCModalProps) {
  const createNc = useCreateNc(obraId);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<NcCategoria>('GERAL');
  const [criticidade, setCriticidade] = useState<NcCriticidade>('MEDIA');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [prazo, setPrazo] = useState('');
  // Autocomplete de documento GED vinculado (opcional)
  const [gedQuery, setGedQuery] = useState('');
  const [gedSelecionado, setGedSelecionado] = useState<GedDocumento | null>(null);
  const [gedResultados, setGedResultados] = useState<GedDocumento[]>([]);
  const [gedBuscando, setGedBuscando] = useState(false);

  // Debounce simples na busca do GED
  useEffect(() => {
    if (gedSelecionado || gedQuery.trim().length < 2) {
      setGedResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setGedBuscando(true);
      try {
        const r = await gedService.listar(obraId, { q: gedQuery.trim(), limit: 8 });
        setGedResultados(r.items ?? []);
      } catch {
        setGedResultados([]);
      } finally {
        setGedBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [gedQuery, gedSelecionado, obraId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createNc.mutate(
      {
        titulo,
        categoria,
        criticidade,
        descricao: descricao || undefined,
        observacoes: observacoes || undefined,
        prazo: prazo || undefined,
        gedVersaoId: gedSelecionado?.versaoAtual?.id ?? undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-[var(--text-high)] mb-4">Nova Não Conformidade</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Título *</label>
            <input
              required
              maxLength={200}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="Descreva a não conformidade..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Categoria</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as NcCategoria)}
                className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Criticidade</label>
              <select
                value={criticidade}
                onChange={(e) => setCriticidade(e.target.value as NcCriticidade)}
                className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Descrição</label>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              placeholder="Detalhes adicionais..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Prazo</label>
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">
              Documento vinculado (GED) <span className="text-[var(--text-faint)] font-normal">— opcional</span>
            </label>
            {gedSelecionado ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-raised)]">
                <div className="truncate">
                  <span className="font-mono text-xs text-[var(--text-faint)]">{gedSelecionado.codigo}</span>
                  <span className="mx-2 text-[var(--text-faint)]">·</span>
                  <span className="text-[var(--text-high)]">{gedSelecionado.titulo}</span>
                  {gedSelecionado.versaoAtual && (
                    <span className="ml-2 text-xs text-[var(--text-faint)]">
                      (rev {gedSelecionado.versaoAtual.numeroRevisao} · {gedSelecionado.versaoAtual.status})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setGedSelecionado(null); setGedQuery(''); }}
                  className="text-xs text-[var(--text-faint)] hover:text-[var(--text-mid)]"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={gedQuery}
                  onChange={(e) => setGedQuery(e.target.value)}
                  placeholder="Buscar código ou título do documento..."
                  className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                {(gedBuscando || gedResultados.length > 0) && (
                  <div className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-md shadow-lg">
                    {gedBuscando && (
                      <div className="px-3 py-2 text-xs text-[var(--text-faint)]">Buscando...</div>
                    )}
                    {!gedBuscando && gedResultados.length === 0 && gedQuery.trim().length >= 2 && (
                      <div className="px-3 py-2 text-xs text-[var(--text-faint)]">Nenhum documento encontrado.</div>
                    )}
                    {gedResultados.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => { setGedSelecionado(doc); setGedResultados([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] border-b border-[var(--border-dim)] last:border-0"
                      >
                        <span className="font-mono text-xs text-[var(--text-faint)]">{doc.codigo}</span>
                        <span className="mx-2 text-[var(--text-faint)]">·</span>
                        <span className="text-[var(--text-high)]">{doc.titulo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Observações</label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createNc.isPending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {createNc.isPending ? 'Criando...' : 'Criar NC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function NcsListPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const navigate = useNavigate();
  const deleteNc = useDeleteNc();
  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [criticidadeFiltro, setCriticidadeFiltro] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const obraIdNum = Number(obraId);

  const { data, isLoading } = useNcsPorObra(obraIdNum, {
    status: statusFiltro as NcStatus || undefined,
    categoria: categoriaFiltro as NcCategoria || undefined,
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
      {showModal && <NovaNCModal obraId={obraIdNum} onClose={() => setShowModal(false)} />}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Não Conformidades</h1>
          <p className="text-sm text-[var(--text-faint)] mt-0.5">{total} NC{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {obraIdNum && (
            <RelatorioBotao
              tipo="R4_NCS"
              filtros={{ obraId: obraIdNum }}
              formatos={['pdf', 'excel']}
              label="Exportar NCs"
            />
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Nova NC
          </button>
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
          value={categoriaFiltro}
          onChange={(e) => { setCategoriaFiltro(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">Todas as categorias</option>
          {(Object.keys(CATEGORIA_LABEL) as NcCategoria[]).map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
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

      {ncs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[var(--text-faint)] text-sm">Nenhuma NC encontrada. Crie a primeira!</p>
        </div>
      ) : (
        <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
                {['Número', 'Título', 'Categoria', 'Criticidade', 'Status', 'Prazo', ''].map((col) => (
                  <th key={col} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ncs.map((nc, i) => {
                const st = STATUS_LABEL[nc.status] ?? { label: nc.status, cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)]' };
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
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={() => navigate(`/obras/${obraId}/ncs/${nc.id}`)}
                        className="text-[var(--accent)] hover:underline text-left"
                      >
                        {nc.titulo}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-mid)]">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-faint)]">
                        {CATEGORIA_LABEL[nc.categoria] ?? nc.categoria}
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
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => navigate(`/obras/${obraId}/ncs/${nc.id}`)}
                          className="text-xs px-2.5 py-1 rounded border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          Abrir
                        </button>
                        {(nc.status === 'ABERTA' || nc.status === 'CANCELADA') && (
                          <button
                            onClick={() => { if (confirm(`Excluir NC "${nc.numero}"?`)) deleteNc.mutate(nc.id); }}
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
