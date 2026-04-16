// frontend-web/src/modules/fvm/grade/components/LiberarQuarentenaModal.tsx
// Modal de liberação formal de quarentena FVM — design Precision Ops Dark
// Supera o concorrente Consulte GEO: 3 decisões, badge prazo vencido, evidência GED, contexto completo

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, AlertTriangle, Clock, Package, Truck, FileSearch } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLiberarQuarentena } from '../hooks/useLiberarQuarentena';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LoteComStatus {
  id: number;
  status: string;
  quarentena_motivo: string | null;
  quarentena_prazo_dias: number | null;
  quarentena_liberada_em?: string | null;
  numero_lote: string;
  material_nome: string;
  fornecedor_nome: string;
  // data de entrega usada como referência do início da quarentena
  data_entrega?: string;
  created_at?: string;
}

interface LiberarQuarentenaModalProps {
  lote: LoteComStatus;
  onClose: () => void;
  onSucesso: () => void;
}

// ── Schema de validação ───────────────────────────────────────────────────────

const schema = z.object({
  decisao: z.enum(['aprovado', 'aprovado_com_ressalva', 'reprovado'], {
    error: 'Selecione uma decisão',
  }),
  observacao: z
    .string()
    .transform(v => v.trim())
    .pipe(z.string().min(10, 'Mínimo de 10 caracteres').max(500, 'Máximo de 500 caracteres')),
  evidencia_id: z
    .number({ error: 'ID deve ser um número inteiro' })
    .int()
    .positive('ID deve ser positivo')
    .optional()
    .or(z.literal(undefined)),
});

type FormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calcula dias vencidos com base na data de referência + prazo em dias */
function calcularDiasVencidos(
  dataReferencia: string | undefined,
  prazoDias: number | null,
): number | null {
  if (!dataReferencia || !prazoDias) return null;
  const inicio  = new Date(dataReferencia);
  const prazo   = new Date(inicio);
  prazo.setDate(prazo.getDate() + prazoDias);
  const hoje    = new Date();
  const diff    = Math.floor((hoje.getTime() - prazo.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

// ── Config das opções de decisão ──────────────────────────────────────────────

const OPCOES = [
  {
    value: 'aprovado' as const,
    label: 'Aprovado',
    desc: 'Laudo atende os critérios NBR — material liberado para uso',
    iconCls: 'text-[var(--ok-text)]',
    borderSel: 'border-[var(--ok-border)]',
    bgSel: 'bg-[var(--ok-bg)]',
    labelSel: 'text-[var(--ok-text)]',
    btnCls: 'bg-[var(--ok-text)] hover:opacity-90',
    btnLabel: 'Confirmar Aprovação',
    dot: 'bg-[var(--ok-text)]',
  },
  {
    value: 'aprovado_com_ressalva' as const,
    label: 'Aprovado com Ressalva',
    desc: 'Uso liberado com restrições — registrar limitações na observação',
    iconCls: 'text-yellow-400',
    borderSel: 'border-yellow-400/60',
    bgSel: 'bg-yellow-500/10',
    labelSel: 'text-yellow-300',
    btnCls: 'bg-yellow-500 hover:opacity-90',
    btnLabel: 'Confirmar Ressalva',
    dot: 'bg-yellow-400',
  },
  {
    value: 'reprovado' as const,
    label: 'Reprovado',
    desc: 'Devolução do material — NC não sanada pelo laudo',
    iconCls: 'text-[var(--nc-text)]',
    borderSel: 'border-[var(--nc-border)]',
    bgSel: 'bg-[var(--nc-bg)]',
    labelSel: 'text-[var(--nc-text)]',
    btnCls: 'bg-[var(--nc-text)] hover:opacity-90',
    btnLabel: 'Confirmar Reprovação',
    dot: 'bg-[var(--nc-text)]',
  },
] as const;

// ── Componente ────────────────────────────────────────────────────────────────

export function LiberarQuarentenaModal({ lote, onClose, onSucesso }: LiberarQuarentenaModalProps) {
  const liberar = useLiberarQuarentena(lote.id);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const decisaoSelecionada = watch('decisao');
  const observacaoAtual    = watch('observacao') ?? '';

  // Previne scroll do body enquanto modal está aberto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Fecha ao pressionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Referência temporal: usa created_at ou data_entrega como proxy do início da quarentena
  const dataRef = lote.created_at ?? lote.data_entrega;
  const diasVencidos = calcularDiasVencidos(dataRef, lote.quarentena_prazo_dias);

  const opcaoAtual = OPCOES.find(o => o.value === decisaoSelecionada);

  async function onSubmit(values: FormValues) {
    await liberar.mutateAsync({
      decisao:      values.decisao,
      observacao:   values.observacao,
      evidencia_id: values.evidencia_id,
    });
    onSucesso();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-[var(--bg-base)] rounded-xl border border-[var(--border-dim)] shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-dim)] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--text-high)] leading-none">
                Liberar Quarentena
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-500/15 text-orange-400 border border-orange-500/30">
                quarentena
              </span>
            </div>
            <p className="text-xs text-[var(--text-faint)] mt-1 truncate">
              Revisão formal de liberação — Eldox FVM
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors"
            aria-label="Fechar modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Corpo (scrollável) ───────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto"
          noValidate
        >
          <div className="px-5 py-4 flex flex-col gap-4">

            {/* ── Card de contexto da quarentena ─────────────────────────── */}
            <div className="rounded-lg border border-[var(--warn-border,#fbbf2430)] bg-[var(--warn-bg,#fbbf2408)] p-3.5 flex flex-col gap-2.5">

              {/* Motivo */}
              {lote.quarentena_motivo && (
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className="text-[var(--warn-text,#fbbf24)] shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--warn-text,#fbbf24)] font-medium leading-snug">
                    {lote.quarentena_motivo}
                  </p>
                </div>
              )}

              {/* Badge prazo vencido */}
              {diasVencidos !== null && (
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-[var(--nc-text)] shrink-0" />
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)] uppercase tracking-wide">
                    Prazo vencido há {diasVencidos} {diasVencidos === 1 ? 'dia' : 'dias'}
                  </span>
                  {lote.quarentena_prazo_dias && (
                    <span className="text-[10px] text-[var(--text-faint)]">
                      (prazo: {lote.quarentena_prazo_dias}d)
                    </span>
                  )}
                </div>
              )}

              {/* Dados do lote */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 border-t border-[var(--warn-border,#fbbf2420)]">
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]">
                  <Package size={10} className="shrink-0" />
                  <span className="text-[var(--text-high)]">{lote.material_nome}</span>
                </span>
                <span className="text-[11px] text-[var(--text-faint)]">
                  Lote <span className="text-[var(--text-high)] font-mono">{lote.numero_lote}</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]">
                  <Truck size={10} className="shrink-0" />
                  {lote.fornecedor_nome}
                </span>
              </div>
            </div>

            {/* ── Seleção de decisão ─────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-2">
                Decisão
              </p>
              <div className="flex flex-col gap-2">
                {OPCOES.map(opt => {
                  const selected = decisaoSelecionada === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue('decisao', opt.value, { shouldValidate: true })}
                      className={cn(
                        'w-full text-left px-3.5 py-3 rounded-lg border-2 transition-all duration-150',
                        selected
                          ? `${opt.borderSel} ${opt.bgSel}`
                          : 'border-[var(--border-dim)] hover:border-[var(--accent)] hover:bg-[var(--bg-raised)]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', opt.dot)} />
                        <span className={cn(
                          'text-sm font-semibold',
                          selected ? opt.labelSel : 'text-[var(--text-high)]',
                        )}>
                          {opt.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-faint)] mt-0.5 ml-4 leading-snug">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
              {errors.decisao && (
                <p className="text-xs text-[var(--nc-text)] mt-1">{errors.decisao.message}</p>
              )}
            </div>

            {/* ── Observação obrigatória ─────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Observação <span className="text-[var(--nc-text)]">*</span>
                </label>
                <span className={cn(
                  'text-[10px] font-mono tabular-nums',
                  observacaoAtual.length > 450
                    ? 'text-[var(--nc-text)]'
                    : observacaoAtual.length > 350
                    ? 'text-[var(--warn-text,#fbbf24)]'
                    : 'text-[var(--text-faint)]',
                )}>
                  {observacaoAtual.length}/500 caracteres
                </span>
              </div>
              <textarea
                {...register('observacao')}
                rows={3}
                placeholder="Descreva o resultado do laudo e a justificativa da decisão..."
                className={cn(
                  'w-full text-sm px-3 py-2.5 rounded-md border bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none resize-none transition-colors',
                  'placeholder:text-[var(--text-faint)] placeholder:text-xs',
                  errors.observacao
                    ? 'border-[var(--nc-border)] focus:border-[var(--nc-border)]'
                    : 'border-[var(--border-dim)] focus:border-[var(--accent)]',
                )}
              />
              {errors.observacao && (
                <p className="text-xs text-[var(--nc-text)] mt-1">{errors.observacao.message}</p>
              )}
            </div>

            {/* ── Evidência GED (opcional) ───────────────────────────────── */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileSearch size={12} className="text-[var(--text-faint)]" />
                <label className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Evidência GED
                  <span className="ml-1.5 text-[10px] font-normal normal-case tracking-normal text-[var(--text-faint)]">
                    opcional
                  </span>
                </label>
              </div>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="ID do documento GED (ex: 1042)"
                onChange={e => {
                  const val = e.target.value;
                  setValue(
                    'evidencia_id',
                    val === '' ? undefined : parseInt(val, 10),
                    { shouldValidate: true },
                  );
                }}
                className={cn(
                  'w-full text-sm px-3 py-2 rounded-md border bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none transition-colors',
                  'placeholder:text-[var(--text-faint)] placeholder:text-xs',
                  errors.evidencia_id
                    ? 'border-[var(--nc-border)] focus:border-[var(--nc-border)]'
                    : 'border-[var(--border-dim)] focus:border-[var(--accent)]',
                )}
              />
              <p className="text-[11px] text-[var(--text-faint)] mt-1">
                Vincule o laudo que fundamenta esta decisão
              </p>
              {errors.evidencia_id && (
                <p className="text-xs text-[var(--nc-text)] mt-0.5">{errors.evidencia_id.message}</p>
              )}
            </div>

            {/* Erro da API */}
            {liberar.isError && (
              <div className="rounded-md border border-[var(--nc-border)] bg-[var(--nc-bg)] px-3 py-2">
                <p className="text-xs text-[var(--nc-text)] font-medium">
                  {(liberar.error as any)?.response?.data?.message ?? 'Erro ao processar a solicitação'}
                </p>
              </div>
            )}
          </div>

          {/* ── Rodapé fixo ─────────────────────────────────────────────────── */}
          <div className="px-5 py-4 border-t border-[var(--border-dim)] flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={liberar.isPending}
              className="flex-1 py-2.5 rounded-lg border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--text-faint)] transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || liberar.isPending}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                opcaoAtual ? opcaoAtual.btnCls : 'bg-[var(--accent)] hover:opacity-90',
              )}
            >
              {liberar.isPending
                ? 'Processando...'
                : opcaoAtual?.btnLabel ?? 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
