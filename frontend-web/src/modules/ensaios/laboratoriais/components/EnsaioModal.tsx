// frontend-web/src/modules/ensaios/laboratoriais/components/EnsaioModal.tsx
// Modal de criação de Ensaio Laboratorial — SPEC 2

import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2, Paperclip, AlertTriangle, CheckCircle, XCircle, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCriarEnsaio } from '../hooks/useEnsaios';
import { useListarLaboratorios } from '../../laboratorios/hooks/useLaboratorios';
import { useListarTipos } from '../../tipos/hooks/useTiposEnsaio';
import { ensaiosService } from '@/services/ensaios.service';
import type { TipoEnsaio, ExtrairLaudoResult } from '@/services/ensaios.service';
// Agent F (2026-04-20): referência opcional à especificação técnica via GED
import { GedDocSelector } from '@/modules/ged/components/GedDocSelector';

// ── Schema Zod ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const resultadoSchema = z.object({
  ensaio_tipo_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ error: 'Selecione o tipo' }).int().positive('Selecione o tipo'),
  ),
  valor_obtido: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ error: 'Informe o valor' }).min(0, 'Valor deve ser ≥ 0'),
  ),
  observacao: z.string().max(255).optional().or(z.literal('')),
});

const schema = z.object({
  laboratorio_id: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ error: 'Selecione o laboratório' }).int().positive('Selecione o laboratório'),
  ),
  data_ensaio: z
    .string()
    .min(1, 'Data obrigatória')
    .refine((v) => {
      const hoje = new Date().toISOString().slice(0, 10);
      return v <= hoje;
    }, 'Data não pode ser futura'),
  nota_fiscal_ref: z.string().max(100).optional().or(z.literal('')),
  observacoes: z.string().max(500).optional().or(z.literal('')),
  resultados: z
    .array(resultadoSchema)
    .min(1, 'Adicione ao menos um resultado'),
  arquivo_mime_type: z
    .enum(['application/pdf', 'image/jpeg', 'image/png', ''])
    .optional(),
});

type FormData = z.infer<typeof schema>;

// ── Helpers / constantes ──────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';

const LABEL_CLS = 'block text-xs font-medium text-[var(--text-faint)] mb-1';

const ERROR_CLS = 'text-xs text-[var(--nc-text)] mt-1';

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Cálculo de aprovado_auto em tempo real ────────────────────────────────────

function calcAprovadoAuto(
  tipo: TipoEnsaio | undefined,
  valor: number | undefined,
): boolean | null {
  if (!tipo || valor === undefined || isNaN(valor)) return null;
  if (tipo.valor_ref_min === null && tipo.valor_ref_max === null) return null;
  if (tipo.valor_ref_min !== null && valor < tipo.valor_ref_min) return false;
  if (tipo.valor_ref_max !== null && valor > tipo.valor_ref_max) return false;
  return true;
}

function ReferenciaTipo({ tipo }: { tipo: TipoEnsaio | undefined }) {
  if (!tipo) return null;
  const { valor_ref_min: min, valor_ref_max: max, unidade, norma_tecnica } = tipo;

  let texto = '';
  if (min !== null && max !== null) texto = `${min}–${max} ${unidade}`;
  else if (min !== null) texto = `≥ ${min} ${unidade}`;
  else if (max !== null) texto = `≤ ${max} ${unidade}`;
  else texto = 'Sem ref. — aprovação manual';

  return (
    <p className="text-[10px] text-[var(--text-faint)] mt-1">
      {texto}{norma_tecnica ? ` | ${norma_tecnica}` : ''}
    </p>
  );
}

function AprovadoAutoIndicator({ status }: { status: boolean | null }) {
  if (status === null) return null;
  if (status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]">
        <CheckCircle size={10} /> Aprovado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]">
      <XCircle size={10} /> Reprovado
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  obraId: number;
  fvmLoteId?: number;
  onClose: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EnsaioModal({ obraId, fvmLoteId, onClose }: Props) {
  const criarEnsaio = useCriarEnsaio();
  const { data: laboratorios = [] } = useListarLaboratorios();
  const { data: tiposEnsaio = [] } = useListarTipos({ ativo: true });

  // Estado do arquivo
  const [arquivoInfo, setArquivoInfo] = useState<{
    nome: string;
    tamanho: number;
    mime: string;
    base64: string;
  } | null>(null);
  const [arquivoErro, setArquivoErro] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado EldoX.IA
  const [iaLoading, setIaLoading] = useState(false);
  const [iaErro, setIaErro] = useState<string | null>(null);
  const [iaExtraido, setIaExtraido] = useState<ExtrairLaudoResult | null>(null);

  // Agent F (2026-04-20): versão GED da especificação técnica (opcional)
  const [gedVersaoIdSpec, setGedVersaoIdSpec] = useState<number | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      laboratorio_id: undefined,
      data_ensaio: hojeISO(),
      nota_fiscal_ref: '',
      observacoes: '',
      resultados: [{ ensaio_tipo_id: undefined as any, valor_obtido: undefined as any, observacao: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'resultados' });
  const resultadosWatch = watch('resultados');

  // Fechar com Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Upload de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoErro(null);

    if (file.size > MAX_FILE_BYTES) {
      setArquivoErro(`Arquivo muito grande: ${formatBytes(file.size)}. Máximo: 25 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const MIMES_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!MIMES_ACEITOS.includes(file.type)) {
      setArquivoErro('Tipo de arquivo não suportado. Use PDF, JPEG ou PNG.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // Remove o prefixo "data:...;base64,"
      const base64 = result.split(',')[1] ?? result;
      setArquivoInfo({ nome: file.name, tamanho: file.size, mime: file.type, base64 });
      setValue('arquivo_mime_type', file.type as any);
    };
    reader.readAsDataURL(file);
  };

  const removerArquivo = () => {
    setArquivoInfo(null);
    setArquivoErro(null);
    setValue('arquivo_mime_type', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExtract = async () => {
    if (!arquivoInfo || arquivoInfo.mime !== 'application/pdf') return;
    setIaLoading(true);
    setIaErro(null);
    setIaExtraido(null);
    try {
      const tipos = (tiposEnsaio as TipoEnsaio[]).map((t) => ({
        id: t.id,
        nome: t.nome,
        unidade: t.unidade,
      }));
      const result = await ensaiosService.extrairLaudo({
        arquivo_base64: arquivoInfo.base64,
        mime_type: 'application/pdf',
        tipos_disponiveis: tipos,
      });
      setIaExtraido(result);
      // Pre-preenche o formulário
      if (result.data_ensaio) setValue('data_ensaio', result.data_ensaio);
      if (result.observacoes) setValue('observacoes', result.observacoes);
      if (result.resultados.length > 0) {
        // Substitui os resultados existentes via setValue
        const novosResultados = result.resultados.map((r) => ({
          ensaio_tipo_id: r.tipo_id ?? (undefined as any),
          valor_obtido: r.valor_obtido ?? (undefined as any),
          observacao: '',
        }));
        setValue('resultados', novosResultados);
      }
    } catch (err: unknown) {
      setIaErro(err instanceof Error ? err.message : 'Erro ao extrair laudo');
    } finally {
      setIaLoading(false);
    }
  };

  const onSubmit = (data: FormData) => {
    const payload = {
      obra_id: obraId,
      fvm_lote_id: fvmLoteId ?? 0,
      laboratorio_id: data.laboratorio_id,
      data_ensaio: data.data_ensaio,
      nota_fiscal_ref: data.nota_fiscal_ref || undefined,
      observacoes: data.observacoes || undefined,
      resultados: data.resultados.map((r) => ({
        ensaio_tipo_id: r.ensaio_tipo_id,
        valor_obtido: r.valor_obtido,
        observacao: r.observacao || undefined,
      })),
      arquivo: arquivoInfo
        ? { base64: arquivoInfo.base64, nome_original: arquivoInfo.nome, mime_type: arquivoInfo.mime }
        : undefined,
      ia_confianca: iaExtraido?.confianca,
      ged_versao_id_spec: gedVersaoIdSpec ?? undefined,
    };

    criarEnsaio.mutate(payload, {
      onSuccess: () => {
        window.alert('Ensaio registrado. Revisão criada automaticamente.');
        onClose();
      },
    });
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-xl shadow-[var(--shadow-lg)] w-full max-w-2xl flex flex-col max-h-[94vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)] shrink-0">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-high)]">
                Novo Ensaio Laboratorial
              </h2>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                Registre o resultado do ensaio e o laudo do laboratório
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body com scroll */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {/* ── Seção 1: Identificação ──────────────────────────────── */}
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
                  Identificação
                </h3>
                <div className="space-y-3">

                  {/* Obra (read-only) */}
                  <div>
                    <label className={LABEL_CLS}>Obra</label>
                    <input
                      readOnly
                      value={`Obra #${obraId}`}
                      className={cn(INPUT_CLS, 'opacity-60 cursor-not-allowed')}
                    />
                  </div>

                  {/* Laboratório */}
                  <div>
                    <label className={LABEL_CLS}>
                      Laboratório <span className="text-[var(--nc-text)]">*</span>
                    </label>
                    <select
                      {...register('laboratorio_id')}
                      className={INPUT_CLS}
                    >
                      <option value="">— Selecione o laboratório —</option>
                      {laboratorios
                        .filter((l) => l.ativo)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.nome}
                          </option>
                        ))}
                    </select>
                    {errors.laboratorio_id && (
                      <p className={ERROR_CLS}>{errors.laboratorio_id.message}</p>
                    )}
                  </div>

                  {/* Data + NF Ref */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>
                        Data do Ensaio <span className="text-[var(--nc-text)]">*</span>
                      </label>
                      <input
                        type="date"
                        max={hojeISO()}
                        {...register('data_ensaio')}
                        className={INPUT_CLS}
                      />
                      {errors.data_ensaio && (
                        <p className={ERROR_CLS}>{errors.data_ensaio.message}</p>
                      )}
                    </div>
                    <div>
                      <label className={LABEL_CLS}>NF Referência</label>
                      <input
                        {...register('nota_fiscal_ref')}
                        placeholder="NF-e 00123"
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className={LABEL_CLS}>Observações</label>
                    <textarea
                      rows={2}
                      {...register('observacoes')}
                      placeholder="Observações gerais sobre o ensaio..."
                      className={cn(INPUT_CLS, 'resize-none')}
                    />
                  </div>

                  {/* Agent F (2026-04-20): especificação técnica opcional via GED */}
                  <div>
                    <label className={LABEL_CLS}>
                      Especificação (GED) <span className="opacity-60">— opcional</span>
                    </label>
                    <GedDocSelector
                      obraId={obraId}
                      value={gedVersaoIdSpec}
                      onChange={(id) => setGedVersaoIdSpec(id)}
                      placeholder="Planta, memorial ou especificação técnica..."
                    />
                    <p className="text-[10px] text-[var(--text-faint)] mt-1">
                      Documento que define os parâmetros esperados do ensaio (vigentes — IFC/IFP/AS_BUILT).
                    </p>
                  </div>
                </div>
              </section>

              {/* ── Seção 2: Resultados ─────────────────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
                    Resultados <span className="text-[var(--nc-text)]">*</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      append({ ensaio_tipo_id: undefined as any, valor_obtido: undefined as any, observacao: '' })
                    }
                    className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity font-medium"
                  >
                    <Plus size={13} />
                    Adicionar resultado
                  </button>
                </div>

                {(errors.resultados as any)?.root?.message && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-3">
                    <AlertTriangle size={13} className="text-[var(--nc-text)] shrink-0" />
                    <p className="text-xs text-[var(--nc-text)]">
                      {(errors.resultados as any).root.message}
                    </p>
                  </div>
                )}
                {typeof errors.resultados?.message === 'string' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-3">
                    <AlertTriangle size={13} className="text-[var(--nc-text)] shrink-0" />
                    <p className="text-xs text-[var(--nc-text)]">{errors.resultados.message}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {fields.map((field, idx) => {
                    const tipoIdAtual = Number(resultadosWatch[idx]?.ensaio_tipo_id);
                    const tipoAtual = tiposEnsaio.find((t) => t.id === tipoIdAtual);
                    const valorAtual = Number(resultadosWatch[idx]?.valor_obtido);
                    const aprovadoAuto = calcAprovadoAuto(tipoAtual, valorAtual);

                    return (
                      <div
                        key={field.id}
                        className="p-3 border border-[var(--border-dim)] rounded-lg bg-[var(--bg-surface)] space-y-2"
                      >
                        <div className="flex items-start gap-2">

                          {/* Número do resultado */}
                          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[var(--bg-raised)] text-[10px] font-semibold text-[var(--text-faint)] mt-2">
                            {idx + 1}
                          </span>

                          <div className="flex-1 space-y-2">
                            {/* Tipo de ensaio + valor */}
                            <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                              <div>
                                <Controller
                                  name={`resultados.${idx}.ensaio_tipo_id`}
                                  control={control}
                                  render={({ field: f }) => (
                                    <select
                                      {...f}
                                      value={f.value ?? ''}
                                      className={INPUT_CLS}
                                    >
                                      <option value="">— Tipo de ensaio —</option>
                                      {tiposEnsaio.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.nome}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                />
                                {errors.resultados?.[idx]?.ensaio_tipo_id && (
                                  <p className={ERROR_CLS}>
                                    {errors.resultados[idx]?.ensaio_tipo_id?.message}
                                  </p>
                                )}
                                <ReferenciaTipo tipo={tipoAtual} />
                              </div>

                              <div className="w-28">
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  placeholder="Valor"
                                  {...register(`resultados.${idx}.valor_obtido`)}
                                  className={INPUT_CLS}
                                />
                                {errors.resultados?.[idx]?.valor_obtido && (
                                  <p className={ERROR_CLS}>
                                    {errors.resultados[idx]?.valor_obtido?.message}
                                  </p>
                                )}
                                <div className="mt-1">
                                  <AprovadoAutoIndicator status={aprovadoAuto} />
                                </div>
                              </div>
                            </div>

                            {/* Observação do resultado */}
                            <input
                              {...register(`resultados.${idx}.observacao`)}
                              placeholder="Observação (opcional)"
                              className={cn(INPUT_CLS, 'text-xs')}
                            />
                          </div>

                          {/* Remover */}
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(idx)}
                              className="shrink-0 p-1.5 mt-1 rounded text-[var(--text-faint)] hover:text-[var(--nc-text)] hover:bg-[var(--nc-bg)] transition-colors"
                              aria-label="Remover resultado"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Seção 3: Laudo (upload) ─────────────────────────────── */}
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
                  Laudo (opcional)
                </h3>

                {!arquivoInfo ? (
                  <div>
                    <label
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 px-4 py-5 border border-dashed border-[var(--border-dim)] rounded-lg cursor-pointer',
                        'hover:border-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors',
                      )}
                    >
                      <Paperclip size={18} className="text-[var(--text-faint)]" />
                      <span className="text-xs text-[var(--text-faint)]">
                        Clique para selecionar PDF, JPEG ou PNG — máx. 25 MB
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    {arquivoErro && (
                      <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-[var(--nc-bg)] border border-[var(--nc-border)]">
                        <AlertTriangle size={13} className="text-[var(--nc-text)] shrink-0" />
                        <p className="text-xs text-[var(--nc-text)]">{arquivoErro}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-3 py-2.5 border border-[var(--border-dim)] rounded-lg bg-[var(--bg-surface)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip size={14} className="text-[var(--accent)] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--text-high)] truncate">{arquivoInfo.nome}</p>
                          <p className="text-[10px] text-[var(--text-faint)]">
                            {formatBytes(arquivoInfo.tamanho)} · {arquivoInfo.mime}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {arquivoInfo.mime === 'application/pdf' && (
                          <button
                            type="button"
                            onClick={handleExtract}
                            disabled={iaLoading}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                              iaLoading
                                ? 'bg-[var(--bg-raised)] text-[var(--text-faint)] cursor-not-allowed'
                                : 'bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black border border-[var(--accent)]/30',
                            )}
                          >
                            {iaLoading ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                Extraindo...
                              </>
                            ) : (
                              <>
                                <Sparkles size={13} />
                                Extrair com IA
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={removerArquivo}
                          className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--nc-text)] transition-colors"
                          aria-label="Remover arquivo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Banner IA extraído */}
                    {iaExtraido && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-700 bg-amber-950/40 text-amber-300 text-xs">
                        <Sparkles size={13} className="shrink-0" />
                        <span>
                          Dados extraídos pela IA —{' '}
                          <strong>revise antes de salvar</strong>.
                          Confiança: {Math.round(iaExtraido.confianca * 100)}%
                        </span>
                      </div>
                    )}
                    {iaErro && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-800 bg-red-950/40 text-red-300 text-xs">
                        <AlertTriangle size={13} className="shrink-0" />
                        {iaErro}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border-dim)] shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={criarEnsaio.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {criarEnsaio.isPending ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Registrando…
                  </>
                ) : (
                  'Registrar Ensaio'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
