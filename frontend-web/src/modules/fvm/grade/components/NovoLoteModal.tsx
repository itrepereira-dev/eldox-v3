// frontend-web/src/modules/fvm/grade/components/NovoLoteModal.tsx
// Modal de criação de lote (nova entrega de material)

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateLote, useMateriais, useFornecedores, useCreateFornecedorRapido } from '../hooks/useGradeFvm';
import { cn } from '@/lib/cn';
import { X, Plus, ChevronDown } from 'lucide-react';

// ── Schema de validação ────────────────────────────────────────────────────

const novoLoteSchema = z.object({
  material_id:     z.number({ error: 'Selecione o material' }).min(1, 'Selecione o material'),
  fornecedor_id:   z.number({ error: 'Selecione o fornecedor' }).min(1, 'Selecione o fornecedor'),
  numero_nf:       z.string().min(1, 'Número da NF obrigatório').max(60),
  data_entrega:    z.string().min(1, 'Data de entrega obrigatória'),
  quantidade_nf:   z.number({ error: 'Quantidade obrigatória' }).positive('Informe uma quantidade válida'),
  unidade:         z.string().min(1, 'Unidade obrigatória'),
  // opcionais
  numero_pedido:   z.string().optional(),
  lote_fabricante: z.string().optional(),
  validade:        z.string().optional(),
  hora_chegada:    z.string().optional(),
});

const novoFornecedorSchema = z.object({
  razao_social: z.string().min(2, 'Razão social obrigatória'),
  cnpj:         z.string().optional(),
});

type NovoLoteForm       = z.infer<typeof novoLoteSchema>;
type NovoFornecedorForm = z.infer<typeof novoFornecedorSchema>;

interface Props {
  obraId: number;
  onClose: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────

export function NovoLoteModal({ obraId, onClose }: Props) {
  const [criandoFornecedor, setCriandoFornecedor] = useState(false);
  const [erroApi, setErroApi]                     = useState<string | null>(null);

  const { data: materiais    = [] } = useMateriais();
  const { data: fornecedores = [] } = useFornecedores();

  const createLote       = useCreateLote(obraId);
  const createFornRapido = useCreateFornecedorRapido();

  // Form principal
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NovoLoteForm>({ resolver: zodResolver(novoLoteSchema) });

  // Form inline de fornecedor
  const {
    register:    regForn,
    handleSubmit: handleForn,
    reset:        resetForn,
    formState: { errors: errForn, isSubmitting: submForn },
  } = useForm<NovoFornecedorForm>({ resolver: zodResolver(novoFornecedorSchema) });

  // Auto-preencher unidade ao selecionar material
  const materialIdWatched = watch('material_id');
  useEffect(() => {
    const mat = materiais.find(m => m.id === Number(materialIdWatched));
    if (mat?.unidade) {
      setValue('unidade', mat.unidade, { shouldValidate: true });
    }
  }, [materialIdWatched, materiais, setValue]);

  const materialSelecionado = materiais.find(m => m.id === Number(materialIdWatched));

  // ── Criar fornecedor inline e selecionar automaticamente ────────────────
  async function onCriarFornecedor(data: NovoFornecedorForm) {
    try {
      const novo = await createFornRapido.mutateAsync({
        razao_social: data.razao_social,
        cnpj:         data.cnpj || undefined,
      });
      setValue('fornecedor_id', novo.id, { shouldValidate: true });
      setCriandoFornecedor(false);
      resetForn();
    } catch {
      // erro tratado pelo próprio mutateAsync — pode adicionar toast aqui se necessário
    }
  }

  // ── Submeter lote ────────────────────────────────────────────────────────
  async function onSubmit(data: NovoLoteForm) {
    setErroApi(null);
    try {
      await createLote.mutateAsync({
        material_id:   data.material_id,
        fornecedor_id: data.fornecedor_id,
        numero_nf:     data.numero_nf,
        data_entrega:  data.data_entrega,
        quantidade:    data.quantidade_nf,   // CreateLotePayload.quantidade
        quantidade_nf: data.quantidade_nf,
        unidade:       data.unidade,
        numero_pedido:   data.numero_pedido   || undefined,
        lote_fabricante: data.lote_fabricante || undefined,
        validade:        data.validade        || undefined,
        hora_chegada:    data.hora_chegada    || undefined,
      });
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErroApi(err?.response?.data?.message ?? 'Erro ao registrar entrega. Tente novamente.');
    }
  }

  const inputCls = (hasError: boolean) =>
    cn(
      'w-full text-sm px-3 py-2 rounded-md border bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]',
      hasError ? 'border-[var(--nc-border)]' : 'border-[var(--border-dim)]',
    );

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[var(--bg-base)] rounded-xl border border-[var(--border-dim)] shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-dim)]">
            <h2 className="text-base font-semibold text-[var(--text-high)] m-0">Nova Entrega de Material</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

            {/* ── Material ──────────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
                Material <span className="text-[var(--nc-text)]">*</span>
              </label>
              <select
                {...register('material_id', { valueAsNumber: true })}
                className={inputCls(!!errors.material_id)}
              >
                <option value="">Selecione o material</option>
                {materiais.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
              {errors.material_id && (
                <p className="text-xs text-[var(--nc-text)] mt-1">{errors.material_id.message}</p>
              )}
              {materialSelecionado?.norma_referencia && (
                <p className="text-[10px] text-[var(--text-faint)] mt-1">
                  Norma: {materialSelecionado.norma_referencia}
                </p>
              )}
            </div>

            {/* ── Fornecedor (com criação inline) ───────────────────────── */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
                Fornecedor <span className="text-[var(--nc-text)]">*</span>
              </label>

              {!criandoFornecedor ? (
                <div className="flex gap-2">
                  <select
                    {...register('fornecedor_id', { valueAsNumber: true })}
                    className={cn(inputCls(!!errors.fornecedor_id), 'flex-1')}
                  >
                    <option value="">Selecione o fornecedor</option>
                    {fornecedores.map(f => (
                      <option
                        key={f.id}
                        value={f.id}
                        disabled={f.situacao === 'suspenso' || f.situacao === 'desqualificado'}
                      >
                        {f.razao_social}
                        {f.situacao !== 'homologado' && f.situacao !== 'em_avaliacao'
                          ? ` (${f.situacao})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCriandoFornecedor(true)}
                    className="flex items-center gap-1 px-3 py-2 rounded-md border border-[var(--border-dim)] text-xs text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors whitespace-nowrap"
                  >
                    <Plus size={12} />
                    Novo
                  </button>
                </div>
              ) : (
                /* Formulário inline de fornecedor */
                <div className="border border-[var(--accent)] rounded-md p-3 bg-[var(--bg-raised)] flex flex-col gap-2.5">
                  <p className="text-xs font-semibold text-[var(--accent)] m-0">Cadastrar Fornecedor</p>

                  <div>
                    <input
                      {...regForn('razao_social')}
                      placeholder="Razão Social *"
                      className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    {errForn.razao_social && (
                      <p className="text-xs text-[var(--nc-text)] mt-0.5">{errForn.razao_social.message}</p>
                    )}
                  </div>

                  <input
                    {...regForn('cnpj')}
                    placeholder="CNPJ (opcional)"
                    className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleForn(onCriarFornecedor)}
                      disabled={submForn}
                      className="flex-1 text-sm px-3 py-1.5 rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {submForn ? 'Salvando...' : 'Salvar e Selecionar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCriandoFornecedor(false); resetForn(); }}
                      className="text-sm px-3 py-1.5 rounded-md border border-[var(--border-dim)] text-[var(--text-faint)] hover:text-[var(--text-high)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {errors.fornecedor_id && !criandoFornecedor && (
                <p className="text-xs text-[var(--nc-text)] mt-1">{errors.fornecedor_id.message}</p>
              )}
            </div>

            {/* ── Grid de campos obrigatórios ───────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
                  Número da NF <span className="text-[var(--nc-text)]">*</span>
                </label>
                <input
                  {...register('numero_nf')}
                  placeholder="Ex: 12345"
                  className={inputCls(!!errors.numero_nf)}
                />
                {errors.numero_nf && (
                  <p className="text-xs text-[var(--nc-text)] mt-1">{errors.numero_nf.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
                  Data de Entrega <span className="text-[var(--nc-text)]">*</span>
                </label>
                <input
                  type="date"
                  {...register('data_entrega')}
                  max={new Date().toISOString().split('T')[0]}
                  className={inputCls(!!errors.data_entrega)}
                />
                {errors.data_entrega && (
                  <p className="text-xs text-[var(--nc-text)] mt-1">{errors.data_entrega.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
                  Quantidade <span className="text-[var(--nc-text)]">*</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  {...register('quantidade_nf', { valueAsNumber: true })}
                  placeholder="0"
                  className={inputCls(!!errors.quantidade_nf)}
                />
                {errors.quantidade_nf && (
                  <p className="text-xs text-[var(--nc-text)] mt-1">{errors.quantidade_nf.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
                  Unidade <span className="text-[var(--nc-text)]">*</span>
                </label>
                <input
                  {...register('unidade')}
                  placeholder="Ex: sc, kg, m³, un"
                  className={inputCls(!!errors.unidade)}
                />
                {errors.unidade && (
                  <p className="text-xs text-[var(--nc-text)] mt-1">{errors.unidade.message}</p>
                )}
              </div>
            </div>

            {/* ── Campos opcionais (colapsável) ─────────────────────────── */}
            <details className="group">
              <summary className="text-xs text-[var(--text-faint)] cursor-pointer hover:text-[var(--text-high)] flex items-center gap-1 select-none list-none">
                <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                Mais detalhes
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-faint)] mb-1">Número do Pedido</label>
                  <input
                    {...register('numero_pedido')}
                    placeholder="Ex: PED-001"
                    className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-faint)] mb-1">Lote do Fabricante</label>
                  <input
                    {...register('lote_fabricante')}
                    placeholder="Ex: L-2024-04"
                    className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-faint)] mb-1">Validade</label>
                  <input
                    type="date"
                    {...register('validade')}
                    className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-faint)] mb-1">Hora de Chegada</label>
                  <input
                    type="time"
                    {...register('hora_chegada')}
                    className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </details>

            {/* Erro da API */}
            {erroApi && (
              <p className="text-xs text-[var(--nc-text)] bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded-md px-3 py-2">
                {erroApi}
              </p>
            )}
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--border-dim)] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting || createLote.isPending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting || createLote.isPending ? 'Registrando...' : 'Registrar Entrega'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
