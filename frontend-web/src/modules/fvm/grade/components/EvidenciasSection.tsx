// frontend-web/src/modules/fvm/grade/components/EvidenciasSection.tsx
// Seção de evidências (documentos vinculados) na FichaLotePage
// Melhoria sobre o GEO: seção dedicada, badges por tipo, skeleton, preview sem fundo preto

import { useState } from 'react';
import {
  Plus, Eye, Trash2, FileText, Image as ImageIcon,
  File, AlertCircle, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useEvidencias, useDesvincularEvidencia } from '../hooks/useEvidencias';
import type { TipoEvidencia, EvidenciaLote } from '../hooks/useEvidencias';
import { EvidenciaUploadModal } from './EvidenciaUploadModal';
import { EvidenciaPreviewModal } from './EvidenciaPreviewModal';

// ─── Config de badges por tipo ────────────────────────────────────────────────

export const TIPO_BADGE: Record<TipoEvidencia, { label: string; cls: string }> = {
  nf:            { label: 'NF',            cls: 'bg-blue-950/60 text-blue-300 border-blue-800' },
  certificado:   { label: 'Certificado',   cls: 'bg-emerald-950/60 text-emerald-300 border-emerald-800' },
  laudo:         { label: 'Laudo',         cls: 'bg-purple-950/60 text-purple-300 border-purple-800' },
  foto:          { label: 'Foto',          cls: 'bg-orange-950/60 text-orange-300 border-orange-800' },
  ficha_tecnica: { label: 'Ficha Técnica', cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border-[var(--border-dim)]' },
  outro:         { label: 'Outro',         cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border-[var(--border-dim)]' },
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

function FileIcon({ mimeType, size = 16 }: { mimeType: string; size?: number }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={size} />;
  if (mimeType === 'application/pdf') return <FileText size={size} />;
  return <File size={size} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EvidenciasSectionProps {
  loteId: number;
  obraId: number;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EvidenciasSection({ loteId, obraId }: EvidenciasSectionProps) {
  const { data: evidencias = [], isLoading, isError, error } = useEvidencias(loteId);
  const desvincular = useDesvincularEvidencia(loteId);

  const [uploadOpen, setUploadOpen]   = useState(false);
  const [preview, setPreview]         = useState<EvidenciaLote | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  async function handleDesvincular(id: number) {
    await desvincular.mutateAsync(id);
    setConfirmDelete(null);
  }

  return (
    <section className="mt-6">

      {/* ── Header da seção ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="text-[var(--text-faint)]" />
          <h2 className="text-sm font-semibold text-[var(--text-high)] m-0">
            Documentos
          </h2>
          {!isLoading && (
            <span className="text-[10px] font-mono bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-faint)] px-1.5 py-0.5 rounded-full">
              {evidencias.length}
            </span>
          )}
        </div>

        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-high)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <Plus size={13} />
          Adicionar
        </button>
      </div>

      {/* ── Estado de erro ───────────────────────────────────────────────── */}
      {isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-[var(--nc-border)] bg-[var(--nc-bg)] text-[var(--nc-text)] text-xs">
          <AlertCircle size={14} className="shrink-0" />
          <span>
            Erro ao carregar documentos: {(error as any)?.response?.data?.message ?? 'tente novamente.'}
          </span>
        </div>
      )}

      {/* ── Skeleton de loading ──────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-base)]">
              <div className="w-7 h-7 rounded-md bg-[var(--bg-raised)] animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-2/5 rounded bg-[var(--bg-raised)] animate-pulse" />
                <div className="h-2.5 w-1/3 rounded bg-[var(--bg-raised)] animate-pulse" />
              </div>
              <div className="h-5 w-16 rounded bg-[var(--bg-raised)] animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* ── Estado vazio ─────────────────────────────────────────────────── */}
      {!isLoading && !isError && evidencias.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-lg border border-dashed border-[var(--border-dim)] bg-[var(--bg-base)] text-center">
          <Paperclip size={24} className="text-[var(--text-faint)] mb-2" />
          <p className="text-sm text-[var(--text-faint)] m-0">
            Nenhum documento vinculado.
          </p>
          <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">
            Adicione a NF, certificados e laudos do lote.
          </p>
        </div>
      )}

      {/* ── Lista de documentos ──────────────────────────────────────────── */}
      {!isLoading && evidencias.length > 0 && (
        <div className="flex flex-col gap-2">
          {evidencias.map(ev => {
            const badge = TIPO_BADGE[ev.tipo];
            return (
              <div
                key={ev.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-base)] hover:border-[var(--accent)]/40 transition-colors group"
              >
                {/* Ícone de tipo de arquivo */}
                <div className="w-7 h-7 rounded-md bg-[var(--bg-raised)] flex items-center justify-center text-[var(--text-faint)] shrink-0">
                  <FileIcon mimeType={ev.ged_mime_type} size={14} />
                </div>

                {/* Metadados */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {/* Badge de tipo */}
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
                      badge.cls,
                    )}>
                      {badge.label}
                    </span>

                    {/* Nome do documento */}
                    <span className="text-sm text-[var(--text-high)] truncate">
                      {ev.ged_titulo}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Código GED em fonte mono */}
                    <span className="text-[10px] font-mono text-[var(--text-faint)]">
                      {ev.ged_codigo}
                    </span>

                    <span className="text-[var(--border-dim)]">·</span>

                    {/* Status GED */}
                    <span className="text-[10px] font-mono text-[var(--text-faint)] border border-[var(--border-dim)] px-1 py-px rounded">
                      {ev.ged_status}
                    </span>

                    {/* Tamanho */}
                    <span className="text-[10px] text-[var(--text-faint)]">
                      {formatBytes(ev.ged_tamanho_bytes)}
                    </span>
                  </div>

                  {/* Descrição opcional */}
                  {ev.descricao && (
                    <p className="text-[11px] text-[var(--text-faint)] m-0 mt-0.5 truncate italic">
                      {ev.descricao}
                    </p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Preview */}
                  <button
                    onClick={() => setPreview(ev)}
                    className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-faint)] hover:text-[var(--accent)] hover:bg-[var(--bg-raised)] transition-colors"
                    title="Visualizar documento"
                  >
                    <Eye size={14} />
                  </button>

                  {/* Desvincular */}
                  <button
                    onClick={() => setConfirmDelete(ev.id)}
                    className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-faint)] hover:text-[var(--nc-text)] hover:bg-[var(--nc-bg)] transition-colors"
                    title="Desvincular documento"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de Upload ──────────────────────────────────────────────── */}
      {uploadOpen && (
        <EvidenciaUploadModal
          loteId={loteId}
          obraId={obraId}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {/* ── Modal de Preview ─────────────────────────────────────────────── */}
      {preview && (
        <EvidenciaPreviewModal
          evidencia={preview}
          onClose={() => setPreview(null)}
        />
      )}

      {/* ── Modal de confirmação de desvínculo ───────────────────────────── */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-[var(--bg-base)] rounded-xl border border-[var(--border-dim)] shadow-2xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-high)] mb-1">
              Desvincular documento?
            </h3>
            <p className="text-xs text-[var(--text-faint)] mb-4">
              O documento continuará no GED. Apenas o vínculo com este lote será removido.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-md border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDesvincular(confirmDelete)}
                disabled={desvincular.isPending}
                className="flex-1 py-2 rounded-md bg-[var(--nc-text)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {desvincular.isPending ? 'Removendo...' : 'Desvincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
