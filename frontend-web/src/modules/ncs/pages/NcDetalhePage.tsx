// frontend-web/src/modules/ncs/pages/NcDetalhePage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useNc, useUpdateNc } from '../hooks/useNcs';
import type { NcStatus, NcCriticidade, NcCategoria } from '../../../services/ncs.service';

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

  const nc = data?.data;

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
    setEditMode(true);
  };

  const handleSave = () => {
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
