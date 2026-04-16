// frontend-web/src/modules/fvm/catalogo/components/MaterialModal.tsx
// Modal de criação/edição de material — 3 abas: Dados | Itens | Documentos
// Equivalente ao ServicoModal do FVS

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Trash2, GripVertical, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { FvmMaterial, TipoItem, Criticidade } from '@/services/fvm.service';
import {
  useCreateMaterial, useUpdateMaterial,
  useCreateItem, useDeleteItem,
  useMaterialDetalhe,
} from '../hooks/useCatalogoFvm';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  nome:                  z.string().min(1, 'Nome obrigatório').max(200),
  codigo:                z.string().max(50).optional(),
  norma_referencia:      z.string().max(200).optional(),
  unidade:               z.string().min(1, 'Unidade obrigatória').max(20),
  descricao:             z.string().optional(),
  foto_modo:             z.enum(['nenhuma', 'opcional', 'obrigatoria']),
  exige_certificado:     z.boolean(),
  exige_nota_fiscal:     z.boolean(),
  exige_laudo_ensaio:    z.boolean(),
  prazo_quarentena_dias: z.number().int().min(0),
});
type FormData = z.infer<typeof schema>;

// ── Tipos de aba ──────────────────────────────────────────────────────────────

type Aba = 'dados' | 'itens' | 'documentos';

const CRITICIDADE_LABEL: Record<string, string> = {
  critico: 'Crítico', maior: 'Maior', menor: 'Menor',
};
const CRITICIDADE_CLS: Record<string, string> = {
  critico: 'bg-red-100 text-red-700 border border-red-200',
  maior:   'bg-yellow-100 text-yellow-700 border border-yellow-200',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
};
const TIPO_LABEL: Record<string, string> = {
  visual: 'Visual', documental: 'Documental',
  dimensional: 'Dimensional', ensaio: 'Ensaio',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  material:    FvmMaterial | null;     // null = criação
  categoriaId: number | null;
  onClose:     () => void;
}

// ── Formulário de item inline ─────────────────────────────────────────────────

function NovoItemForm({
  materialId,
  onSaved,
}: {
  materialId: number;
  onSaved: () => void;
}) {
  const [descricao,   setDescricao]  = useState('');
  const [tipo,        setTipo]       = useState<TipoItem>('visual');
  const [criticidade, setCrit]       = useState<Criticidade>('menor');
  const createItem = useCreateItem(materialId);

  const handleSave = () => {
    if (!descricao.trim()) return;
    createItem.mutate(
      { tipo, descricao: descricao.toUpperCase(), criticidade },
      { onSuccess: () => { setDescricao(''); onSaved(); } },
    );
  };

  return (
    <div className="border border-[var(--border-dim)] rounded-lg p-3 bg-[var(--bg-raised)] space-y-2">
      <input
        value={descricao}
        onChange={e => setDescricao(e.target.value)}
        placeholder="Descrição do item (ex: CERTIFICADO PRESENTE?)"
        className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-1.5 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        onKeyDown={e => e.key === 'Enter' && handleSave()}
      />
      <div className="flex gap-2">
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value as TipoItem)}
          className="flex-1 bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-2 py-1.5 text-xs text-[var(--text-high)]"
        >
          {Object.entries(TIPO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={criticidade}
          onChange={e => setCrit(e.target.value as Criticidade)}
          className="flex-1 bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-2 py-1.5 text-xs text-[var(--text-high)]"
        >
          <option value="critico">Crítico</option>
          <option value="maior">Maior</option>
          <option value="menor">Menor</option>
        </select>
        <button
          onClick={handleSave}
          disabled={!descricao.trim() || createItem.isPending}
          className="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-50"
        >
          {createItem.isPending ? '…' : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function MaterialModal({ material, categoriaId, onClose }: Props) {
  const isEdicao  = material !== null;
  const isSistema = material?.is_sistema ?? false;
  const [abaAtiva, setAba] = useState<Aba>('dados');

  const { data: detalhes } = useMaterialDetalhe(material?.id ?? null);
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial(material?.id ?? 0);
  const deleteItem     = useDeleteItem(material?.id ?? 0);

  const {
    register, handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome:                  material?.nome ?? '',
      codigo:                material?.codigo ?? '',
      norma_referencia:      material?.norma_referencia ?? '',
      unidade:               material?.unidade ?? 'un',
      descricao:             material?.descricao ?? '',
      foto_modo:             (material?.foto_modo as any) ?? 'opcional',
      exige_certificado:     material?.exige_certificado ?? false,
      exige_nota_fiscal:     material?.exige_nota_fiscal ?? true,
      exige_laudo_ensaio:    material?.exige_laudo_ensaio ?? false,
      prazo_quarentena_dias: material?.prazo_quarentena_dias ?? 0,
    },
  });

  // Fecha com Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      categoria_id: categoriaId ?? material?.categoria_id,
    };
    if (isEdicao) {
      updateMaterial.mutate(payload, { onSuccess: onClose });
    } else {
      createMaterial.mutate(payload, { onSuccess: onClose });
    }
  };

  const isPending = createMaterial.isPending || updateMaterial.isPending;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-high)]">
                {isEdicao ? 'Editar Material' : 'Novo Material'}
              </h2>
              {isSistema && (
                <p className="text-xs text-[var(--warn-text)] flex items-center gap-1 mt-0.5">
                  <AlertTriangle size={11} />
                  Material do sistema PBQP-H — somente leitura
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Abas */}
          <div className="flex border-b border-[var(--border-dim)] px-5">
            {(['dados', 'itens', 'documentos'] as Aba[]).map(aba => (
              <button
                key={aba}
                onClick={() => setAba(aba)}
                className={cn(
                  'py-2.5 px-3 text-sm border-b-2 -mb-px capitalize transition-colors',
                  abaAtiva === aba
                    ? 'border-[var(--accent)] text-[var(--accent)] font-medium'
                    : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
                )}
              >
                {aba === 'dados' ? 'Dados' : aba === 'itens' ? 'Itens de Verificação' : 'Documentos Exigidos'}
                {aba === 'itens' && detalhes?.itens && (
                  <span className="ml-1.5 text-[10px] bg-[var(--bg-base)] text-[var(--text-faint)] rounded-full px-1.5 py-0.5">
                    {detalhes.itens.filter(i => i.ativo).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Conteúdo */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-4">

              {/* ABA: DADOS */}
              {abaAtiva === 'dados' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Nome *</label>
                      <input
                        {...register('nome')}
                        disabled={isSistema}
                        className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
                      />
                      {errors.nome && <p className="text-xs text-[var(--nc-text)] mt-1">{errors.nome.message}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Código / Referência</label>
                      <input
                        {...register('codigo')}
                        disabled={isSistema}
                        placeholder="NBR 11578"
                        className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Unidade *</label>
                      <input
                        {...register('unidade')}
                        disabled={isSistema}
                        placeholder="kg, m³, sc, un…"
                        className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
                      />
                      {errors.unidade && <p className="text-xs text-[var(--nc-text)] mt-1">{errors.unidade.message}</p>}
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Norma de Referência</label>
                      <input
                        {...register('norma_referencia')}
                        disabled={isSistema}
                        placeholder="NBR 11578:1991"
                        className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Descrição / Especificação</label>
                      <textarea
                        {...register('descricao')}
                        disabled={isSistema}
                        rows={2}
                        className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] resize-none disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Flags de documentação */}
                  <div>
                    <p className="text-xs font-medium text-[var(--text-faint)] mb-2">Documentos obrigatórios no recebimento</p>
                    <div className="space-y-2">
                      {[
                        { field: 'exige_nota_fiscal'  as const, label: 'Nota Fiscal (NF)'                    },
                        { field: 'exige_certificado'  as const, label: 'Certificado de Qualidade (CQ)'       },
                        { field: 'exige_laudo_ensaio' as const, label: 'Laudo de Ensaio laboratorial (LE)'   },
                      ].map(({ field, label }) => (
                        <label key={field} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            {...register(field)}
                            disabled={isSistema}
                            className="accent-[var(--accent)] w-4 h-4"
                          />
                          <span className="text-sm text-[var(--text-high)]">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Foto no recebimento</label>
                      <select
                        {...register('foto_modo')}
                        disabled={isSistema}
                        className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
                      >
                        <option value="nenhuma">Não exigida</option>
                        <option value="opcional">Opcional</option>
                        <option value="obrigatoria">Obrigatória</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-faint)] mb-1">Prazo de quarentena (dias)</label>
                      <input
                        type="number"
                        min={0}
                        {...register('prazo_quarentena_dias', { valueAsNumber: true })}
                        disabled={isSistema}
                        className="w-full bg-[var(--bg-base)] border border-[var(--border-dim)] rounded px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
                      />
                      <p className="text-[10px] text-[var(--text-faint)] mt-0.5">0 = sem quarentena automática</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA: ITENS */}
              {abaAtiva === 'itens' && (
                <div className="space-y-3">
                  {!isEdicao && (
                    <p className="text-sm text-[var(--text-faint)] text-center py-8">
                      Salve o material primeiro para adicionar itens de verificação.
                    </p>
                  )}
                  {isEdicao && isSistema && (
                    <p className="text-xs text-[var(--warn-text)] bg-[var(--warn-bg)] border border-[var(--warn-border)] rounded px-3 py-2">
                      Itens do sistema não podem ser editados. Clone o material para personalizá-lo.
                    </p>
                  )}
                  {isEdicao && !isSistema && (
                    <NovoItemForm materialId={material!.id} onSaved={() => {}} />
                  )}

                  {/* Lista de itens */}
                  {detalhes?.itens?.filter(i => i.ativo).map(item => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 p-3 border border-[var(--border-dim)] rounded-lg bg-[var(--bg-base)]"
                    >
                      <GripVertical size={14} className="text-[var(--text-faint)] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-high)] leading-snug">{item.descricao}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <span className="text-[10px] bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)] px-1.5 py-0.5 rounded">
                            {TIPO_LABEL[item.tipo]}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded', CRITICIDADE_CLS[item.criticidade])}>
                            {CRITICIDADE_LABEL[item.criticidade]}
                          </span>
                        </div>
                      </div>
                      {!isSistema && (
                        <button
                          type="button"
                          onClick={() => deleteItem.mutate(item.id)}
                          className="text-[var(--text-faint)] hover:text-[var(--nc-text)] transition-colors shrink-0 mt-0.5"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}

                  {isEdicao && detalhes?.itens?.filter(i => i.ativo).length === 0 && (
                    <p className="text-sm text-[var(--text-faint)] text-center py-6">
                      Nenhum item adicionado ainda.
                    </p>
                  )}
                </div>
              )}

              {/* ABA: DOCUMENTOS */}
              {abaAtiva === 'documentos' && (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--text-faint)]">
                    Documentos que devem ser anexados no momento do recebimento do lote.
                  </p>

                  {/* Flags como proxy dos documentos exigidos */}
                  <div className="space-y-2">
                    {[
                      { key: 'nf',   label: 'Nota Fiscal', sigla: 'NF',     ativo: true },
                      { key: 'cq',   label: 'Certificado de Qualidade', sigla: 'CQ', ativo: material?.exige_certificado },
                      { key: 'le',   label: 'Laudo de Ensaio', sigla: 'LE', ativo: material?.exige_laudo_ensaio },
                    ].map(doc => (
                      <div
                        key={doc.key}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 border rounded-lg',
                          doc.ativo
                            ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                            : 'border-[var(--border-dim)] bg-[var(--bg-base)] opacity-50',
                        )}
                      >
                        <span className="text-xs font-mono font-bold text-[var(--accent)] w-8">{doc.sigla}</span>
                        <span className="text-sm text-[var(--text-high)]">{doc.label}</span>
                        {doc.ativo && (
                          <span className="ml-auto text-[10px] text-[var(--ok-text)]">Obrigatório</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-[var(--text-faint)] pt-1">
                    Para adicionar documentos personalizados, configure as flags na aba <strong>Dados</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isSistema && abaAtiva === 'dados' && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-dim)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || (!isDirty && isEdicao)}
                  className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isPending ? 'Salvando…' : isEdicao ? 'Salvar alterações' : 'Criar material'}
                </button>
              </div>
            )}
            {(isSistema || abaAtiva !== 'dados') && (
              <div className="flex justify-end px-5 py-3 border-t border-[var(--border-dim)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
