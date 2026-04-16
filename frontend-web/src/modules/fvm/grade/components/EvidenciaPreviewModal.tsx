// frontend-web/src/modules/fvm/grade/components/EvidenciaPreviewModal.tsx
// Modal de preview inline de documento — melhoria sobre o GEO (skeleton, URL auto-renovada)

import { useState, useEffect } from 'react';
import { X, ExternalLink, FileText, Image, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EvidenciaLote, TipoEvidencia } from '../hooks/useEvidencias';
import { TIPO_BADGE } from './EvidenciasSection';
import { useDownloadUrl } from '../hooks/useEvidencias';

interface EvidenciaPreviewModalProps {
  evidencia: EvidenciaLote;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const isImage = (mimeType: string) =>
  mimeType.startsWith('image/');

const isPdf = (mimeType: string) =>
  mimeType === 'application/pdf';

// ── Componente ────────────────────────────────────────────────────────────────

export function EvidenciaPreviewModal({ evidencia, onClose }: EvidenciaPreviewModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [renewCountdown, setRenewCountdown] = useState<number | null>(null);

  // Busca a URL pré-assinada (renovada automaticamente a cada 4 min via staleTime)
  const { data: downloadData, isFetching, refetch } = useDownloadUrl(evidencia.ged_versao_id);

  const previewUrl = downloadData?.presignedUrl ?? evidencia.download_url;
  const expiresIn  = downloadData?.expiresInSeconds ?? evidencia.download_expires_in ?? 300;

  // Contador regressivo de "URL expira em Xs"
  useEffect(() => {
    setRenewCountdown(expiresIn);
    const interval = setInterval(() => {
      setRenewCountdown(prev => {
        if (prev === null || prev <= 1) {
          refetch();
          return expiresIn;
        }
        return prev - 1;
      });
    }, 1_000);
    return () => clearInterval(interval);
  }, [expiresIn, refetch]);

  // Resetar estado de carregamento quando a URL mudar
  useEffect(() => {
    if (previewUrl) setIframeLoaded(false);
  }, [previewUrl]);

  const tipoBadge = TIPO_BADGE[evidencia.tipo as TipoEvidencia];

  const minutosRestantes = renewCountdown !== null
    ? Math.ceil(renewCountdown / 60)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-2xl flex flex-col"
           style={{ height: '85vh' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-dim)] shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 text-[var(--text-faint)] shrink-0">
              {isImage(evidencia.ged_mime_type)
                ? <Image size={18} />
                : <FileText size={18} />
              }
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text-high)] m-0 truncate">
                {evidencia.ged_titulo}
              </h2>
              <p className="text-xs font-mono text-[var(--text-faint)] m-0 mt-0.5">
                {evidencia.ged_codigo}
              </p>
              {evidencia.ged_nome_original !== evidencia.ged_titulo && (
                <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5 truncate">
                  {evidencia.ged_nome_original} · {formatBytes(evidencia.ged_tamanho_bytes)}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="ml-4 mt-0.5 text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Área de preview ────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden bg-[#020D1A]">

          {/* Skeleton animado enquanto carrega (melhoria sobre o GEO) */}
          {(!iframeLoaded || !previewUrl) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
              <div className="flex flex-col items-center gap-3 w-full max-w-xs px-8">
                <div className="w-12 h-12 rounded-lg bg-[var(--bg-raised)] animate-pulse" />
                <div className="w-full h-3 rounded bg-[var(--bg-raised)] animate-pulse" />
                <div className="w-4/5 h-3 rounded bg-[var(--bg-raised)] animate-pulse" />
                <div className="w-3/5 h-3 rounded bg-[var(--bg-raised)] animate-pulse" />
              </div>
              {isFetching && (
                <p className="text-xs text-[var(--text-faint)] flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" />
                  Carregando documento...
                </p>
              )}
            </div>
          )}

          {/* Preview — PDF via iframe nativo (sem dependência JS) */}
          {previewUrl && isPdf(evidencia.ged_mime_type) && (
            <iframe
              src={previewUrl}
              title={evidencia.ged_titulo}
              sandbox="allow-same-origin allow-scripts"
              className={cn(
                'w-full h-full border-0 transition-opacity duration-300',
                iframeLoaded ? 'opacity-100' : 'opacity-0',
              )}
              onLoad={() => setIframeLoaded(true)}
            />
          )}

          {/* Preview — Imagens via <img> com object-contain */}
          {previewUrl && isImage(evidencia.ged_mime_type) && (
            <img
              src={previewUrl}
              alt={evidencia.ged_titulo}
              className={cn(
                'w-full h-full object-contain transition-opacity duration-300',
                iframeLoaded ? 'opacity-100' : 'opacity-0',
              )}
              onLoad={() => setIframeLoaded(true)}
            />
          )}

          {/* Fallback para outros tipos */}
          {previewUrl && !isPdf(evidencia.ged_mime_type) && !isImage(evidencia.ged_mime_type) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <FileText size={40} className="text-[var(--text-faint)]" />
              <p className="text-sm text-[var(--text-faint)]">
                Preview não disponível para este tipo de arquivo.
              </p>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={14} />
                  Abrir arquivo
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Rodapé ─────────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-[var(--border-dim)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {/* Badge de tipo */}
            {tipoBadge && (
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', tipoBadge.cls)}>
                {tipoBadge.label}
              </span>
            )}

            {/* Status GED */}
            <span className="text-[10px] font-mono text-[var(--text-faint)] border border-[var(--border-dim)] px-1.5 py-0.5 rounded">
              {evidencia.ged_status}
            </span>

            {/* Data */}
            <span className="text-xs text-[var(--text-faint)]">
              {formatDate(evidencia.criado_em)}
            </span>

            {/* Descrição */}
            {evidencia.descricao && (
              <span className="text-xs text-[var(--text-faint)] truncate max-w-[200px]" title={evidencia.descricao}>
                {evidencia.descricao}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Indicador de renovação automática da URL */}
            {minutosRestantes !== null && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]"
                    title="URL pré-assinada renovada automaticamente">
                <Clock size={10} />
                URL expira em {minutosRestantes} min — renovando automaticamente
              </span>
            )}

            {/* Abrir em nova aba */}
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity"
              >
                <ExternalLink size={12} />
                Abrir em nova aba
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
