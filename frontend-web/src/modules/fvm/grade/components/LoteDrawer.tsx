// frontend-web/src/modules/fvm/grade/components/LoteDrawer.tsx
// Drawer lateral que abre ao clicar em uma célula da grade FVM
// Padrão idêntico ao GradeDrawer.tsx do FVS

import { useLotePreview } from '../hooks/useGradeFvm';
import { cn } from '@/lib/cn';
import { X, ArrowRight, Lock } from 'lucide-react';
import type { StatusLote } from '../pages/GradeMateriaisPage';

interface LoteDrawerProps {
  loteId: number;
  onClose: () => void;
  onAbrirFicha?: (loteId: number) => void;
}

// Mesmo padrão de STATUS_BADGE do GradeDrawer FVS
const STATUS_BADGE: Record<StatusLote, { label: string; cls: string; icon?: React.ReactNode }> = {
  aguardando_inspecao:   { label: 'Aguardando',           cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
  em_inspecao:           { label: 'Em Inspeção',           cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  aprovado:              { label: 'Aprovado',              cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
  aprovado_com_ressalva: { label: 'Aprovado c/ Ressalva',  cls: 'bg-yellow-50 text-yellow-800 border border-yellow-200' },
  quarentena:            { label: 'Quarentena',            cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  reprovado:             { label: 'Reprovado',             cls: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]' },
  cancelado:             { label: 'Cancelado',             cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
};

const CRIT_CLS: Record<string, string> = {
  critico: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]',
  maior:   'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
};

const ITEM_STATUS_CLS: Record<string, string> = {
  conforme:      'text-[var(--ok-text)]',
  nao_conforme:  'text-[var(--nc-text)]',
  nao_aplicavel: 'text-[var(--text-faint)]',
  nao_avaliado:  'text-[var(--text-faint)]',
};

const ITEM_STATUS_ICON: Record<string, string> = {
  conforme:      '✓',
  nao_conforme:  '✗',
  nao_aplicavel: 'N/A',
  nao_avaliado:  '—',
};

export function LoteDrawer({ loteId, onClose, onAbrirFicha }: LoteDrawerProps) {
  const { data: preview, isLoading } = useLotePreview(loteId);

  const badge = preview ? STATUS_BADGE[preview.status as StatusLote] : null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer — idêntico em estrutura ao GradeDrawer FVS */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--bg-base)] border-l border-[var(--border-dim)] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div className="min-w-0">
            {isLoading ? (
              <div className="h-5 w-40 bg-[var(--bg-raised)] rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-high)] m-0">
                    {preview?.numero_lote}
                  </h3>
                  {badge && (
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', badge.cls)}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">
                  {preview?.material_nome}
                  {preview?.fornecedor_nome && ` · ${preview.fornecedor_nome}`}
                </p>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors ml-4 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-5 flex flex-col gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-[var(--bg-raised)] rounded animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && preview && (
            <>
              {/* ── Dados do lote ─────────────────────────────────────────── */}
              <div className="px-5 py-3 border-b border-[var(--border-dim)]">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-[var(--text-faint)] uppercase tracking-wide text-[10px]">NF</dt>
                    <dd className="text-[var(--text-high)] font-medium mt-0.5">{preview.numero_nf}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-faint)] uppercase tracking-wide text-[10px]">Entrega</dt>
                    <dd className="text-[var(--text-high)] font-medium mt-0.5">{preview.data_entrega}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-faint)] uppercase tracking-wide text-[10px]">Quantidade</dt>
                    <dd className="text-[var(--text-high)] font-medium mt-0.5">{preview.quantidade_nf ?? preview.quantidade_recebida ?? 0} {preview.unidade}</dd>
                  </div>
                  {preview.validade && (
                    <div>
                      <dt className="text-[var(--text-faint)] uppercase tracking-wide text-[10px]">Validade</dt>
                      <dd className={cn('font-medium mt-0.5', preview.validade && new Date(preview.validade) < new Date() ? 'text-[var(--nc-text)]' : 'text-[var(--text-high)]')}>
                        {preview.validade}
                        {preview.validade && new Date(preview.validade) < new Date() && ' ⚠'}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* ── Alerta de quarentena ──────────────────────────────────── */}
              {preview.status === 'quarentena' && preview.quarentena_motivo && (
                <div className="mx-5 mt-3 flex items-start gap-2 p-3 rounded-md bg-orange-50 border border-orange-200">
                  <Lock size={14} className="text-orange-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-orange-800 m-0">Material em Quarentena</p>
                    <p className="text-xs text-orange-700 m-0 mt-0.5">{preview.quarentena_motivo}</p>
                  </div>
                </div>
              )}

              {/* ── Checklist de itens — padrão igual ao GradeDrawer FVS ─── */}
              {preview.itens && preview.itens.length > 0 && (
                <table className="w-full text-xs border-collapse mt-2">
                  <thead className="sticky top-0 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide w-6">#</th>
                      <th className="text-left px-2 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide">Item</th>
                      <th className="text-right px-4 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.itens.map((reg, i) => (
                      <tr
                        key={reg.id}
                        className={cn(
                          'border-b border-[var(--border-dim)] last:border-0',
                          i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                        )}
                      >
                        <td className="px-4 py-2.5 text-[var(--text-faint)] font-mono">{i + 1}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-[10px] font-semibold px-1 py-0.5 rounded', CRIT_CLS[reg.criticidade])}>
                              {reg.criticidade.toUpperCase().slice(0, 3)}
                            </span>
                            <span className="text-[var(--text-high)] leading-tight">{reg.descricao}</span>
                          </div>
                          {reg.registro_status === 'nao_conforme' && reg.registro_observacao && (
                            <p className="text-[var(--nc-text)] text-[10px] mt-1 ml-8 m-0 italic">{reg.registro_observacao}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={cn('font-bold', ITEM_STATUS_CLS[reg.registro_status ?? 'nao_avaliado'])}>
                            {ITEM_STATUS_ICON[reg.registro_status ?? 'nao_avaliado']}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* Footer com CTA — equivalente ao ArrowRight do GradeDrawer FVS */}
        {!isLoading && preview && (
          <div className="px-5 py-4 border-t border-[var(--border-dim)] flex flex-col gap-2">
            {preview.status === 'aguardando_inspecao' || preview.status === 'em_inspecao' ? (
              <button
                onClick={() => { onClose(); onAbrirFicha?.(loteId); }}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <span>{preview.status === 'aguardando_inspecao' ? 'Iniciar Inspeção' : 'Continuar Inspeção'}</span>
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => { onClose(); onAbrirFicha?.(loteId); }}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-md border border-[var(--border-dim)] text-[var(--text-high)] text-sm font-medium hover:bg-[var(--bg-raised)] transition-colors"
              >
                <span>Ver Ficha Completa</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
