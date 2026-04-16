// frontend-web/src/modules/ensaios/revisoes/components/RevisaoModal.tsx
// Modal de Aprovação / Reprovação de Laudo — SPEC 3

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, CheckCircle2, XCircle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRevisarLaudo } from '../hooks/useRevisoes';
import type { EnsaioRevisaoDetalhe } from '@/services/ensaios.service';

// ── Schema Zod ────────────────────────────────────────────────────────────────

const schema = z
  .object({
    situacao: z.enum(['APROVADO', 'REPROVADO']),
    observacao: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.situacao === 'REPROVADO' &&
      (!data.observacao || data.observacao.trim().length < 10)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Justificativa obrigatória (mínimo 10 caracteres)',
        path: ['observacao'],
      });
    }
  });

type FormData = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const LABEL_CLS = 'block text-xs font-medium text-[var(--text-faint)] mb-1';
const ERROR_CLS = 'text-xs text-[var(--nc-text)] mt-1';

function formatData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function buildRefTexto(
  min: number | null | undefined,
  max: number | null | undefined,
  unidade: string | undefined,
  norma: string | null | undefined,
): string {
  const u = unidade ?? '';
  let ref = '';
  if (min != null && max != null) ref = `${min}–${max} ${u}`;
  else if (min != null) ref = `≥ ${min} ${u}`;
  else if (max != null) ref = `≤ ${max} ${u}`;
  else ref = 'Sem ref.';
  return norma ? `${ref} (${norma})` : ref;
}

// ── Componente de badge de resultado ─────────────────────────────────────────

function AprovadoBadge({ status }: { status: boolean | null }) {
  if (status === true) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800">
        <CheckCircle2 size={10} />
        Dentro da NBR
      </span>
    );
  }
  if (status === false) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-950/60 text-red-300 border border-red-800">
        <XCircle size={10} />
        Fora da NBR
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]">
      Manual
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  revisao: EnsaioRevisaoDetalhe;
  onClose: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function RevisaoModal({ revisao, onClose }: Props) {
  const revisarLaudo = useRevisarLaudo();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      situacao: undefined as any,
      observacao: '',
    },
  });

  const situacaoWatch = watch('situacao');

  // Fechar com Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onSubmit = (data: FormData) => {
    revisarLaudo.mutate(
      {
        id: revisao.id,
        payload: {
          situacao: data.situacao,
          observacao: data.observacao?.trim() || undefined,
        },
      },
      { onSuccess: onClose },
    );
  };

  const loteEmQuarentena = revisao.lote_status === 'QUARENTENA';

  // Cor dinâmica do botão de submit
  const submitCls = cn(
    'flex items-center gap-1.5 px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50 transition-all',
    situacaoWatch === 'APROVADO'
      ? 'bg-emerald-600 hover:bg-emerald-500'
      : situacaoWatch === 'REPROVADO'
        ? 'bg-red-600 hover:bg-red-500'
        : 'bg-[var(--accent)] hover:opacity-90',
  );

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-xl shadow-[var(--shadow-lg)] w-full max-w-xl flex flex-col max-h-[92vh]">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)] shrink-0">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-high)]">
                {revisao.material_nome ?? `Ensaio #${revisao.ensaio_id}`}
              </h2>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                {revisao.laboratorio_nome ?? '—'} · {formatData(revisao.data_ensaio)}
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

          {/* ── Body ───────────────────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {/* Banner quarentena */}
              {loteEmQuarentena && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-blue-950/40 border border-blue-800 text-blue-300">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    Após a decisão, o lote será liberado ou reprovado automaticamente.
                  </p>
                </div>
              )}

              {/* ── Resultados (read-only) ──────────────────────────────── */}
              {revisao.resultados && revisao.resultados.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
                    Resultados do Ensaio
                  </h3>
                  <div className="space-y-2">
                    {revisao.resultados.map((res) => (
                      <div
                        key={res.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-high)] truncate">
                            {res.tipo_nome ?? `Tipo #${res.ensaio_tipo_id}`}
                          </p>
                          <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
                            Obtido:{' '}
                            <span className="text-[var(--text-mid)] font-medium">
                              {res.valor_obtido} {res.tipo_unidade ?? ''}
                            </span>
                            {' · '}
                            Ref:{' '}
                            <span className="text-[var(--text-mid)]">
                              {buildRefTexto(
                                res.tipo_valor_ref_min,
                                res.tipo_valor_ref_max,
                                res.tipo_unidade,
                                res.tipo_norma_tecnica,
                              )}
                            </span>
                          </p>
                        </div>
                        <div className="shrink-0 ml-3">
                          <AprovadoBadge status={res.aprovado_auto} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Decisão (radio cards) ───────────────────────────────── */}
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
                  Decisão
                </h3>
                <div className="grid grid-cols-2 gap-3">

                  {/* Card Aprovar */}
                  <button
                    type="button"
                    onClick={() => setValue('situacao', 'APROVADO', { shouldValidate: true })}
                    className={cn(
                      'flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all cursor-pointer text-left',
                      situacaoWatch === 'APROVADO'
                        ? 'border-emerald-500 bg-emerald-950/40'
                        : 'border-[var(--border-dim)] bg-[var(--bg-surface)] hover:border-emerald-700 hover:bg-emerald-950/20',
                    )}
                  >
                    <CheckCircle2
                      size={24}
                      className={cn(
                        'transition-colors',
                        situacaoWatch === 'APROVADO'
                          ? 'text-emerald-400'
                          : 'text-[var(--text-faint)]',
                      )}
                    />
                    <span
                      className={cn(
                        'text-sm font-semibold transition-colors',
                        situacaoWatch === 'APROVADO'
                          ? 'text-emerald-300'
                          : 'text-[var(--text-mid)]',
                      )}
                    >
                      Aprovar Laudo
                    </span>
                  </button>

                  {/* Card Reprovar */}
                  <button
                    type="button"
                    onClick={() => setValue('situacao', 'REPROVADO', { shouldValidate: true })}
                    className={cn(
                      'flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all cursor-pointer text-left',
                      situacaoWatch === 'REPROVADO'
                        ? 'border-red-500 bg-red-950/40'
                        : 'border-[var(--border-dim)] bg-[var(--bg-surface)] hover:border-red-700 hover:bg-red-950/20',
                    )}
                  >
                    <XCircle
                      size={24}
                      className={cn(
                        'transition-colors',
                        situacaoWatch === 'REPROVADO'
                          ? 'text-red-400'
                          : 'text-[var(--text-faint)]',
                      )}
                    />
                    <span
                      className={cn(
                        'text-sm font-semibold transition-colors',
                        situacaoWatch === 'REPROVADO'
                          ? 'text-red-300'
                          : 'text-[var(--text-mid)]',
                      )}
                    >
                      Reprovar Laudo
                    </span>
                  </button>
                </div>

                {/* Erro do campo situacao (se nenhuma opção selecionada) */}
                {errors.situacao && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-[var(--nc-bg)] border border-[var(--nc-border)]">
                    <AlertCircle size={13} className="text-[var(--nc-text)] shrink-0" />
                    <p className="text-xs text-[var(--nc-text)]">{errors.situacao.message}</p>
                  </div>
                )}
              </section>

              {/* ── Observação ─────────────────────────────────────────── */}
              <section>
                <label className={LABEL_CLS}>
                  Observação
                  {situacaoWatch === 'REPROVADO' && (
                    <span className="text-[var(--nc-text)] ml-0.5">*</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  {...register('observacao')}
                  placeholder={
                    situacaoWatch === 'REPROVADO'
                      ? 'Justifique a reprovação (mínimo 10 caracteres)…'
                      : 'Observação sobre a aprovação (opcional)…'
                  }
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                />
                {errors.observacao && (
                  <p className={ERROR_CLS}>{errors.observacao.message}</p>
                )}
              </section>
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
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
                disabled={revisarLaudo.isPending || !situacaoWatch}
                className={submitCls}
              >
                {revisarLaudo.isPending ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando…
                  </>
                ) : situacaoWatch === 'APROVADO' ? (
                  <>
                    <CheckCircle2 size={14} />
                    Confirmar Aprovação
                  </>
                ) : situacaoWatch === 'REPROVADO' ? (
                  <>
                    <XCircle size={14} />
                    Confirmar Reprovação
                  </>
                ) : (
                  'Selecione uma decisão'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
