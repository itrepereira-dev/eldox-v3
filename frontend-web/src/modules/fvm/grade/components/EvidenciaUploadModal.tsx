// frontend-web/src/modules/fvm/grade/components/EvidenciaUploadModal.tsx
// Modal de upload em 2 etapas: (1) upload GED → (2) classificar e vincular ao lote

import { useState, useRef, useCallback } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, Upload, FileText, Image as ImageIcon, File,
  CheckCircle, ChevronLeft, AlertCircle, CloudUpload,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUploadGed, useVincularEvidencia } from '../hooks/useEvidencias';
import type { TipoEvidencia } from '../hooks/useEvidencias';
import { TIPO_BADGE } from './EvidenciasSection';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXT   = ['.pdf', '.jpg', '.jpeg', '.png'];

// ─── Schema Passo 2 ───────────────────────────────────────────────────────────

const step2Schema = z.object({
  tipo:      z.enum(['NF', 'CERTIFICADO', 'LAUDO', 'FOTO', 'FICHA_TECNICA', 'OUTRO'] as const),
  descricao: z.string().max(200, 'Máximo 200 caracteres').optional(),
});
type Step2Form = z.infer<typeof step2Schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType, size = 20 }: { mimeType: string; size?: number }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={size} />;
  if (mimeType === 'application/pdf')  return <FileText size={size} />;
  return <File size={size} />;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EvidenciaUploadModalProps {
  loteId:  number;
  obraId:  number;
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EvidenciaUploadModal({ loteId, obraId, onClose }: EvidenciaUploadModalProps) {
  const [step, setStep]               = useState<1 | 2>(1);
  const [file, setFile]               = useState<File | null>(null);
  const [fileError, setFileError]     = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [versaoId, setVersaoId]       = useState<number | null>(null);
  const [codigoGed, setCodigoGed]     = useState<string>('');
  const [isDragging, setIsDragging]   = useState(false);
  const [erroApi, setErroApi]         = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadGed  = useUploadGed(obraId);
  const vincular   = useVincularEvidencia(loteId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: { tipo: 'NF', descricao: '' },
  });

  const descricaoValue = watch('descricao') ?? '';

  // ── Validação de arquivo ─────────────────────────────────────────────────

  function validateFile(f: File): string | null {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return 'Tipo não suportado. Use PDF, JPG ou PNG.';
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `Arquivo muito grande. Máximo 25 MB (este: ${formatBytes(f.size)}).`;
    }
    return null;
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) { setFileError(err); setFile(null); return; }
    setFileError(null);
    setFile(f);
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, []);

  // ── Passo 1 → Upload GED ─────────────────────────────────────────────────

  async function handleUpload() {
    if (!file) return;
    setErroApi(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('titulo', file.name.replace(/\.[^/.]+$/, '')); // nome sem extensão

    try {
      const result = await uploadGed.mutateAsync({
        formData,
        onProgress: (pct) => setUploadProgress(pct),
      });
      setVersaoId(result.versaoId);
      setCodigoGed(result.codigoGerado);
      setStep(2);
    } catch (e: any) {
      setErroApi(e?.response?.data?.message ?? 'Erro ao enviar arquivo. Tente novamente.');
    }
  }

  // ── Passo 2 → Vincular ao lote ───────────────────────────────────────────

  async function onSubmitStep2(values: Step2Form) {
    if (!versaoId) return;
    setErroApi(null);

    try {
      await vincular.mutateAsync({
        ged_versao_id: versaoId,
        tipo: values.tipo as TipoEvidencia,
        descricao: values.descricao || undefined,
      });
      onClose();
    } catch (e: any) {
      setErroApi(e?.response?.data?.message ?? 'Erro ao vincular documento. Tente novamente.');
    }
  }

  // ── Indicador de tamanho (barra visual) ──────────────────────────────────

  const sizePercent = file ? Math.round((file.size / MAX_SIZE_BYTES) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[var(--bg-base)] rounded-xl border border-[var(--border-dim)] shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-high)] m-0">
              Adicionar Documento
            </h3>
            <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">
              {step === 1 ? 'Passo 1 de 2 — Enviar arquivo' : 'Passo 2 de 2 — Classificar'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Indicador de progresso de etapas ─────────────────────────────── */}
        <div className="flex gap-1 px-5 pt-4">
          {([1, 2] as const).map(s => (
            <div key={s} className={cn(
              'flex-1 h-1 rounded-full transition-colors duration-300',
              step >= s
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--bg-raised)]',
            )} />
          ))}
        </div>

        {/* ── Passo 1: Upload ───────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-5 flex flex-col gap-4">

            {/* Zona de drag & drop */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative flex flex-col items-center justify-center gap-3 py-8 px-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
                isDragging
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--border-dim)] bg-[var(--bg-raised)] hover:border-[var(--accent)]/60',
              )}
            >
              <CloudUpload size={28} className={cn(
                'transition-colors',
                isDragging ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]',
              )} />

              {file ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-high)]">
                  <FileTypeIcon mimeType={file.type} size={16} />
                  <span className="font-medium truncate max-w-[240px]">{file.name}</span>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-[var(--text-high)] m-0 font-medium">
                    Arraste o arquivo aqui
                  </p>
                  <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">
                    ou clique para escolher
                  </p>
                </div>
              )}

              {/* Tipos aceitos */}
              <div className="flex items-center gap-1.5">
                {['PDF', 'JPG', 'PNG'].map(t => (
                  <span key={t} className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border-dim)] text-[var(--text-faint)]">
                    {t}
                  </span>
                ))}
                <span className="text-[10px] text-[var(--text-faint)]">· máx 25 MB</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXT.join(',')}
                className="sr-only"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
            </div>

            {/* Erro de validação do arquivo */}
            {fileError && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--nc-text)]">
                <AlertCircle size={13} />
                {fileError}
              </div>
            )}

            {/* Barra de tamanho (visual feedback) */}
            {file && (
              <div>
                <div className="flex justify-between text-[10px] text-[var(--text-faint)] mb-1">
                  <span>{formatBytes(file.size)}</span>
                  <span>25 MB</span>
                </div>
                <div className="h-1 rounded-full bg-[var(--bg-raised)] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      sizePercent > 90 ? 'bg-[var(--nc-text)]' : 'bg-[var(--accent)]',
                    )}
                    style={{ width: `${sizePercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Progresso de upload */}
            {uploadGed.isPending && (
              <div>
                <div className="flex justify-between text-[10px] text-[var(--text-faint)] mb-1">
                  <span className="flex items-center gap-1">
                    <Upload size={10} className="animate-bounce" />
                    Fazendo upload...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-raised)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Erro da API */}
            {erroApi && (
              <div className="flex items-start gap-1.5 text-xs text-[var(--nc-text)] bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded-md px-3 py-2">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {erroApi}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-md border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploadGed.isPending}
                className="flex-1 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {uploadGed.isPending ? 'Enviando...' : 'Próximo'}
              </button>
            </div>
          </div>
        )}

        {/* ── Passo 2: Classificar ──────────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleSubmit(onSubmitStep2)} className="p-5 flex flex-col gap-4">

            {/* Arquivo já enviado — confirmação */}
            {file && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-dim)]">
                <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-high)] m-0 truncate font-medium">
                    {file.name}
                  </p>
                  <p className="text-[10px] font-mono text-[var(--text-faint)] m-0 mt-0.5">
                    {codigoGed} · {formatBytes(file.size)}
                  </p>
                </div>
                <FileTypeIcon mimeType={file.type} size={14} />
              </div>
            )}

            {/* Campo: Tipo */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide block mb-1.5">
                Tipo <span className="text-[var(--nc-text)]">*</span>
              </label>
              <select
                {...register('tipo')}
                className="w-full text-sm px-3 py-2.5 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none cursor-pointer"
              >
                {(Object.keys(TIPO_BADGE) as TipoEvidencia[]).map(tipo => (
                  <option key={tipo} value={tipo}>
                    {TIPO_BADGE[tipo].label}
                  </option>
                ))}
              </select>
              {errors.tipo && (
                <p className="text-xs text-[var(--nc-text)] mt-1">{errors.tipo.message}</p>
              )}
            </div>

            {/* Campo: Descrição */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide block mb-1.5">
                Descrição{' '}
                <span className="text-[var(--text-faint)] font-normal normal-case tracking-normal">
                  (opcional)
                </span>
              </label>
              <input
                type="text"
                placeholder='ex: NF 1234 — Bloco cerâmico'
                maxLength={200}
                {...register('descricao')}
                className="w-full text-sm px-3 py-2.5 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <div className="flex justify-between mt-1">
                {errors.descricao
                  ? <p className="text-xs text-[var(--nc-text)]">{errors.descricao.message}</p>
                  : <span />
                }
                <span className={cn(
                  'text-[10px] font-mono',
                  descricaoValue.length > 180 ? 'text-[var(--warn-text)]' : 'text-[var(--text-faint)]',
                )}>
                  {descricaoValue.length}/200
                </span>
              </div>
            </div>

            {/* Erro da API */}
            {erroApi && (
              <div className="flex items-start gap-1.5 text-xs text-[var(--nc-text)] bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded-md px-3 py-2">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {erroApi}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => { setStep(1); setErroApi(null); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
              >
                <ChevronLeft size={14} />
                Voltar
              </button>
              <button
                type="submit"
                disabled={vincular.isPending}
                className="flex-1 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {vincular.isPending ? 'Vinculando...' : 'Vincular ao Lote'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
