// frontend-web/src/modules/ncs/pages/NcDetalhePage.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useNc, useUpdateNc, useUploadNcEvidencia } from '../hooks/useNcs';
import type { NcStatus, NcCriticidade, NcCategoria } from '../../../services/ncs.service';
import { gedService, type GedDocumento } from '../../../services/ged.service';

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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 py-3 border-b border-[var(--border-dim)] last:border-0">
      <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide pt-0.5">{label}</span>
      <div className="text-sm text-[var(--text-high)]">{children}</div>
    </div>
  );
}

// ─── Página de detalhe ────────────────────────────────────────────────────────

export function NcDetalhePage() {
  const { obraId, ncId } = useParams<{ obraId: string; ncId: string }>();
  const navigate = useNavigate();
  const ncIdNum = Number(ncId);

  const { data, isLoading } = useNc(ncIdNum);
  const updateNc = useUpdateNc(ncIdNum);
  const uploadEvidencia = useUploadNcEvidencia(ncIdNum);

  const nc = data?.data;

  // Upload de evidência (drag-and-drop)
  const [dragActive, setDragActive] = useState(false);
  const [uploadOk, setUploadOk] = useState<string | null>(null);
  const [uploadErro, setUploadErro] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleUploadFile(file: File) {
    setUploadOk(null);
    setUploadErro(null);
    // Validação client-side (backend re-valida)
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setUploadErro(`Tipo não permitido: ${file.type}. Use JPG, PNG, WebP, HEIC ou PDF.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadErro(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.`);
      return;
    }
    try {
      const r = await uploadEvidencia.mutateAsync(file);
      setUploadOk(`Evidência anexada: ${r.data.ged_codigo}`);
      // Limpa após 4s
      setTimeout(() => setUploadOk(null), 4000);
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Erro ao enviar arquivo. Tente novamente.';
      setUploadErro(msg);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    e.target.value = '';
  }

  // Estado do formulário de edição inline
  const [editMode, setEditMode] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [status, setStatus] = useState<NcStatus>('ABERTA');
  const [criticidade, setCriticidade] = useState<NcCriticidade>('MEDIA');
  const [categoria, setCategoria] = useState<NcCategoria>('GERAL');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [evidenciaUrl, setEvidenciaUrl] = useState('');
  const [prazo, setPrazo] = useState('');
  // GED autocomplete state
  const [gedVersaoId, setGedVersaoId] = useState<number | null>(null);
  const [gedSelecionado, setGedSelecionado] = useState<GedDocumento | null>(null);
  const [gedQuery, setGedQuery] = useState('');
  const [gedResultados, setGedResultados] = useState<GedDocumento[]>([]);
  const [gedBuscando, setGedBuscando] = useState(false);

  // Debounced GED search (só roda em editMode)
  useEffect(() => {
    if (!editMode || gedSelecionado || gedQuery.trim().length < 2) {
      setGedResultados([]);
      return;
    }
    const obraNum = Number(obraId);
    if (!obraNum) return;
    const t = setTimeout(async () => {
      setGedBuscando(true);
      try {
        const r = await gedService.listar(obraNum, { q: gedQuery.trim(), limit: 8 });
        setGedResultados(r.items ?? []);
      } catch {
        setGedResultados([]);
      } finally {
        setGedBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [editMode, gedQuery, gedSelecionado, obraId]);

  const enterEdit = () => {
    if (!nc) return;
    setTitulo(nc.titulo);
    setStatus(nc.status);
    setCriticidade(nc.criticidade);
    setCategoria(nc.categoria);
    setDescricao(nc.descricao ?? '');
    setObservacoes(nc.observacoes ?? '');
    setEvidenciaUrl(nc.evidencia_url ?? '');
    setPrazo(nc.prazo ? nc.prazo.substring(0, 10) : '');
    setGedVersaoId(nc.ged_versao_id ?? null);
    // Hidrata "GedDocumento-lite" a partir dos campos enriquecidos no response
    if (nc.ged_versao_id && nc.ged_codigo) {
      setGedSelecionado({
        id: 0, // placeholder — não usado no submit
        titulo: nc.ged_titulo ?? '',
        codigo: nc.ged_codigo,
        escopo: 'OBRA',
        pastaId: 0,
        categoriaId: 0,
        categoria: { id: 0, nome: '', codigo: '', escopoPadrao: 'OBRA', requerAprovacao: false },
        versaoAtual: {
          id: nc.ged_versao_id,
          numeroRevisao: nc.ged_numero_revisao ?? '0',
          version: 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: (nc.ged_versao_status as any) ?? 'RASCUNHO',
          tamanhoBytes: 0,
          mimeType: '',
        },
      });
    } else {
      setGedSelecionado(null);
    }
    setGedQuery('');
    setGedResultados([]);
    setEditMode(true);
  };

  const handleSave = () => {
    // Detecta mudança explícita no vínculo GED (inclui "removido": de X para null)
    const gedChanged = (nc?.ged_versao_id ?? null) !== gedVersaoId;
    updateNc.mutate(
      {
        titulo,
        status,
        criticidade,
        categoria,
        descricao: descricao || undefined,
        observacoes: observacoes || undefined,
        evidencia_url: evidenciaUrl || undefined,
        prazo: prazo || undefined,
        ...(gedChanged ? { gedVersaoId: gedVersaoId ?? undefined } : {}),
      },
      { onSuccess: () => setEditMode(false) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  if (!nc) {
    return (
      <div className="p-6">
        <p className="text-[var(--text-faint)] text-sm">NC não encontrada.</p>
      </div>
    );
  }

  const st = STATUS_LABEL[nc.status] ?? { label: nc.status, cls: '' };
  const cr = CRITICIDADE_LABEL[nc.criticidade] ?? { label: nc.criticidade, cls: '' };

  return (
    <div className="p-6 max-w-3xl">
      {/* Navegação */}
      <button
        onClick={() => navigate(`/obras/${obraId}/ncs`)}
        className="flex items-center gap-1.5 text-sm text-[var(--text-faint)] hover:text-[var(--text-mid)] mb-5 transition-colors"
      >
        <ArrowLeft size={14} />
        Voltar para NCs
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm text-[var(--text-faint)]">{nc.numero}</span>
            <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', st.cls)}>
              {st.label}
            </span>
            <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', cr.cls)}>
              {cr.label}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-high)]">{nc.titulo}</h1>
        </div>
        {!editMode && (
          <button
            onClick={enterEdit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] text-sm hover:bg-[var(--bg-hover)] transition-colors"
          >
            Editar
          </button>
        )}
      </div>

      {/* Detalhes — visualização ou edição inline */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden bg-[var(--bg-base)] mb-6">
        <div className="px-5 py-4">
          {editMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">Título *</label>
                <input
                  required
                  maxLength={200}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as NcStatus)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {(Object.keys(STATUS_LABEL) as NcStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">Criticidade</label>
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
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">Categoria</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as NcCategoria)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">Prazo</label>
                  <input
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">URL Evidência</label>
                  <input
                    type="url"
                    value={evidenciaUrl}
                    onChange={(e) => setEvidenciaUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              {/* ── Upload direto de foto/PDF (gera documento GED automaticamente) ── */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
                  Enviar foto / PDF de evidência
                </label>
                <div
                  onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'rounded-md border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors',
                    dragActive
                      ? 'border-[var(--accent)] bg-[var(--accent-bg,rgba(88,166,255,0.06))]'
                      : 'border-[var(--border-dim)] hover:border-[var(--border)] bg-[var(--bg-raised)]',
                    uploadEvidencia.isPending && 'opacity-60 cursor-not-allowed pointer-events-none',
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                    onChange={onInputChange}
                    className="hidden"
                  />
                  <Upload size={22} className={cn('mx-auto mb-1.5', dragActive ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]')} />
                  <p className="text-xs font-medium text-[var(--text-high)]">
                    {uploadEvidencia.isPending
                      ? 'Enviando…'
                      : dragActive
                        ? 'Solte o arquivo aqui'
                        : 'Arraste/solte ou clique para selecionar'}
                  </p>
                  <p className="text-[10px] text-[var(--text-faint)] mt-0.5">JPG, PNG, WebP, HEIC ou PDF · máx 10 MB</p>
                </div>
                {uploadOk && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-[var(--ok,#22c55e)]">
                    <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{uploadOk}</span>
                  </div>
                )}
                {uploadErro && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-[var(--nc,#ef4444)]">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{uploadErro}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
                  Documento vinculado (GED)
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
                      onClick={() => { setGedSelecionado(null); setGedVersaoId(null); setGedQuery(''); }}
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
                      placeholder="Buscar código ou título..."
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
                            onClick={() => {
                              setGedSelecionado(doc);
                              setGedVersaoId(doc.versaoAtual?.id ?? null);
                              setGedResultados([]);
                            }}
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
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border-dim)] rounded-md bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateNc.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  <Save size={14} />
                  {updateNc.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <FieldRow label="Categoria">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-faint)]">
                  {CATEGORIA_LABELS[nc.categoria] ?? nc.categoria}
                </span>
              </FieldRow>
              <FieldRow label="Descrição">
                {nc.descricao ? (
                  <p className="text-[var(--text-mid)] leading-relaxed">{nc.descricao}</p>
                ) : (
                  <span className="text-[var(--text-faint)] italic">—</span>
                )}
              </FieldRow>
              <FieldRow label="Prazo">
                {nc.prazo ? new Date(nc.prazo).toLocaleDateString('pt-BR') : '—'}
              </FieldRow>
              <FieldRow label="Responsável">
                {nc.responsavel_id ? `#${nc.responsavel_id}` : '—'}
              </FieldRow>
              <FieldRow label="Evidência">
                {nc.evidencia_url ? (
                  <a href={nc.evidencia_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline text-sm break-all">
                    {nc.evidencia_url}
                  </a>
                ) : '—'}
              </FieldRow>
              <FieldRow label="Documento GED">
                {nc.ged_versao_id && nc.ged_codigo ? (
                  <a
                    href={`/obras/${obraId}/ged/documentos?q=${encodeURIComponent(nc.ged_codigo)}`}
                    className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline text-sm"
                  >
                    <FileText size={14} />
                    <span className="font-mono text-xs">{nc.ged_codigo}</span>
                    <span className="text-[var(--text-faint)]">·</span>
                    <span>{nc.ged_titulo ?? '—'}</span>
                    {nc.ged_numero_revisao && (
                      <span className="text-xs text-[var(--text-faint)]">
                        (rev {nc.ged_numero_revisao}{nc.ged_versao_status ? ` · ${nc.ged_versao_status}` : ''})
                      </span>
                    )}
                  </a>
                ) : (
                  <span className="text-[var(--text-faint)] italic">—</span>
                )}
              </FieldRow>
              <FieldRow label="Observações">
                {nc.observacoes ? (
                  <p className="text-[var(--text-mid)] leading-relaxed">{nc.observacoes}</p>
                ) : (
                  <span className="text-[var(--text-faint)] italic">—</span>
                )}
              </FieldRow>
              {nc.data_fechamento && (
                <FieldRow label="Fechamento">
                  {new Date(nc.data_fechamento).toLocaleString('pt-BR')}
                </FieldRow>
              )}
              <FieldRow label="Criada em">
                {new Date(nc.created_at).toLocaleString('pt-BR')}
              </FieldRow>
            </>
          )}
        </div>
      </div>

      {/* Origem automática — se existir */}
      {(nc.caminhao_id || nc.cp_id || nc.fvs_ficha_id || nc.fvm_lote_id || nc.ensaio_id) && (
        <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden bg-[var(--bg-base)]">
          <div className="px-5 py-3 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
            <span className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">Origem (Automática)</span>
          </div>
          <div className="px-5 py-4 text-sm text-[var(--text-mid)] space-y-1">
            {nc.caminhao_id && <div>Caminhão de Concreto: <span className="font-medium text-[var(--text-high)]">#{nc.caminhao_id}</span></div>}
            {nc.cp_id && <div>Corpo de Prova: <span className="font-medium text-[var(--text-high)]">#{nc.cp_id}</span></div>}
            {nc.fvs_ficha_id && <div>FVS Ficha: <span className="font-medium text-[var(--text-high)]">#{nc.fvs_ficha_id}</span></div>}
            {nc.fvm_lote_id && <div>FVM Lote: <span className="font-medium text-[var(--text-high)]">#{nc.fvm_lote_id}</span></div>}
            {nc.ensaio_id && <div>Ensaio: <span className="font-medium text-[var(--text-high)]">#{nc.ensaio_id}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}
