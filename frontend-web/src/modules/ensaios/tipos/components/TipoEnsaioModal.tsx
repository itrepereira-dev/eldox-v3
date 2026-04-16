// frontend-web/src/modules/ensaios/tipos/components/TipoEnsaioModal.tsx
// Modal criar/editar Tipo de Ensaio — React Hook Form + Zod

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, ChevronDown, ChevronUp, Info, AlertTriangle } from 'lucide-react';
import type { TipoEnsaio } from '@/services/ensaios.service';
import { useCriarTipo, useAtualizarTipo } from '../hooks/useTiposEnsaio';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    nome: z.string().min(1, 'Nome obrigatório').max(100, 'Máximo 100 caracteres'),
    unidade: z.string().min(1, 'Unidade obrigatória').max(20, 'Máximo 20 caracteres'),
    norma_tecnica: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
    material_tipo: z
      .enum(['bloco_concreto', 'concreto', 'argamassa', 'aco', 'ceramica', 'outro'])
      .optional()
      .or(z.literal('').transform(() => undefined)),
    valor_ref_min: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().min(0).nullable(),
    ),
    valor_ref_max: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().min(0).nullable(),
    ),
    tem_frequencia: z.boolean(),
    frequencia_valor: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().int().min(1).nullable(),
    ),
    frequencia_unidade: z.enum(['dias', 'm3', 'lotes']).optional(),
  })
  .superRefine((data, ctx) => {
    const min = data.valor_ref_min;
    const max = data.valor_ref_max;
    if (min !== null && max !== null && min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mínimo não pode ser maior que o máximo',
        path: ['valor_ref_min'],
      });
    }
    if (data.tem_frequencia && !data.frequencia_valor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe um valor de frequência',
        path: ['frequencia_valor'],
      });
    }
  });

type FormData = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';

const LABEL_CLS = 'block text-xs font-medium text-[var(--text-faint)] mb-1';

const ERROR_CLS = 'text-xs text-[var(--nc-text)] mt-1';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  tipo: TipoEnsaio | null; // null = criação
  onClose: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TipoEnsaioModal({ tipo, onClose }: Props) {
  const isEdicao = tipo !== null;
  const [showFrequencia, setShowFrequencia] = useState(
    !!(tipo?.frequencia_valor && tipo?.frequencia_unidade),
  );

  const criar = useCriarTipo();
  const atualizar = useAtualizarTipo(tipo?.id ?? 0);
  const isPending = criar.isPending || atualizar.isPending;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      nome:               tipo?.nome ?? '',
      unidade:            tipo?.unidade ?? '',
      norma_tecnica:      tipo?.norma_tecnica ?? '',
      material_tipo:      (tipo?.material_tipo as any) ?? '',
      valor_ref_min:      tipo?.valor_ref_min ?? null,
      valor_ref_max:      tipo?.valor_ref_max ?? null,
      tem_frequencia:     !!(tipo?.frequencia_valor && tipo?.frequencia_unidade),
      frequencia_valor:   tipo?.frequencia_valor ?? null,
      frequencia_unidade: tipo?.frequencia_unidade ?? 'dias',
    },
  });

  const valorMin = watch('valor_ref_min');
  const valorMax = watch('valor_ref_max');
  void watch('tem_frequencia'); // reserved for future conditional rendering

  const semReferencia =
    (valorMin === null || valorMin === undefined || String(valorMin) === '') &&
    (valorMax === null || valorMax === undefined || String(valorMax) === '');

  // Sincroniza checkbox com estado local do toggle
  useEffect(() => {
    setValue('tem_frequencia', showFrequencia);
    if (!showFrequencia) {
      setValue('frequencia_valor', null);
    }
  }, [showFrequencia, setValue]);

  // Fecha com Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onSubmit = (data: FormData) => {
    const payload = {
      nome:               data.nome,
      unidade:            data.unidade,
      norma_tecnica:      data.norma_tecnica || null,
      material_tipo:      (data.material_tipo || null) as any,
      valor_ref_min:      data.valor_ref_min,
      valor_ref_max:      data.valor_ref_max,
      frequencia_valor:   data.tem_frequencia ? data.frequencia_valor : null,
      frequencia_unidade: data.tem_frequencia ? (data.frequencia_unidade ?? 'dias') : null,
    };

    if (isEdicao) {
      atualizar.mutate(payload, { onSuccess: onClose });
    } else {
      criar.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-xl shadow-[var(--shadow-lg)] w-full max-w-lg flex flex-col max-h-[92vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)] shrink-0">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-high)]">
                {isEdicao ? 'Editar Tipo de Ensaio' : 'Novo Tipo de Ensaio'}
              </h2>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                {isEdicao ? `Editando: ${tipo.nome}` : 'Configurar referência NBR para aprovação automática de laudos'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* ── Grupo 1: Identificação ─────────────────────────────── */}
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
                  Identificação
                </h3>
                <div className="space-y-3">

                  {/* Nome */}
                  <div>
                    <label className={LABEL_CLS}>
                      Nome <span className="text-[var(--nc-text)]">*</span>
                    </label>
                    <input
                      {...register('nome')}
                      placeholder="ex: Resistência de Bloco"
                      className={INPUT_CLS}
                    />
                    {errors.nome && <p className={ERROR_CLS}>{errors.nome.message}</p>}
                  </div>

                  {/* Unidade + Norma */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>
                        Unidade <span className="text-[var(--nc-text)]">*</span>
                      </label>
                      <input
                        {...register('unidade')}
                        placeholder="MPa, kN/m², ..."
                        className={INPUT_CLS}
                      />
                      {errors.unidade && <p className={ERROR_CLS}>{errors.unidade.message}</p>}
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Norma técnica</label>
                      <input
                        {...register('norma_tecnica')}
                        placeholder="NBR 6136:2016"
                        className={INPUT_CLS}
                      />
                      {errors.norma_tecnica && (
                        <p className={ERROR_CLS}>{errors.norma_tecnica.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Material tipo */}
                  <div>
                    <label className={LABEL_CLS}>Tipo de material</label>
                    <select {...register('material_tipo')} className={INPUT_CLS}>
                      <option value="">— Não especificado —</option>
                      <option value="bloco_concreto">Bloco de Concreto</option>
                      <option value="concreto">Concreto</option>
                      <option value="argamassa">Argamassa</option>
                      <option value="aco">Aço</option>
                      <option value="ceramica">Cerâmica</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Grupo 2: Valores de Referência ───────────────────────── */}
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
                  Valores de Referência NBR
                </h3>

                {/* Banner aprovação manual */}
                {semReferencia && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--warn-bg)] border border-[var(--warn-border)] mb-3">
                    <AlertTriangle size={14} className="text-[var(--warn-text)] shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--warn-text)]">
                      Sem valores de referência — este tipo exigirá <strong>aprovação manual</strong> dos laudos.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Valor mínimo</label>
                    <input
                      type="number"
                      step="any"
                      {...register('valor_ref_min')}
                      placeholder="4.0"
                      className={INPUT_CLS}
                    />
                    {errors.valor_ref_min && (
                      <p className={ERROR_CLS}>{errors.valor_ref_min.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Valor máximo</label>
                    <input
                      type="number"
                      step="any"
                      {...register('valor_ref_max')}
                      placeholder="8.0"
                      className={INPUT_CLS}
                    />
                    {errors.valor_ref_max && (
                      <p className={ERROR_CLS}>{errors.valor_ref_max.message}</p>
                    )}
                  </div>
                </div>

                {/* Dica contextual quando ambos preenchidos */}
                {!semReferencia && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Info size={12} className="text-[var(--run-text)] shrink-0" />
                    <p className="text-[10px] text-[var(--text-faint)]">
                      Laudos dentro da faixa serão aprovados automaticamente
                    </p>
                  </div>
                )}
              </div>

              {/* ── Grupo 3: Frequência (expansível) ─────────────────────── */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowFrequencia((v) => !v)}
                  className="flex items-center gap-2 text-xs font-medium text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
                >
                  {showFrequencia ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Configurar frequência de ensaio
                </button>

                {showFrequencia && (
                  <div className="mt-3 p-3 border border-[var(--border-dim)] rounded-lg bg-[var(--bg-surface)] space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={LABEL_CLS}>
                          A cada
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          {...register('frequencia_valor')}
                          placeholder="25"
                          className={INPUT_CLS}
                        />
                        {errors.frequencia_valor && (
                          <p className={ERROR_CLS}>{errors.frequencia_valor.message}</p>
                        )}
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Unidade</label>
                        <select {...register('frequencia_unidade')} className={INPUT_CLS}>
                          <option value="dias">dias</option>
                          <option value="m3">m³</option>
                          <option value="lotes">lotes</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--text-faint)] leading-relaxed">
                      Ex: NBR 6136 exige ensaio a cada 25 m³ de bloco aplicado
                    </p>
                  </div>
                )}
              </div>
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
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando…
                  </>
                ) : isEdicao ? (
                  'Salvar alterações'
                ) : (
                  'Criar tipo'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
