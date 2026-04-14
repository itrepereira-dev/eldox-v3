// frontend-web/src/modules/fvs/inspecao/components/GradeDrawer.tsx
import { useNavigate } from 'react-router-dom';
import { useGradePreview } from '../hooks/useGrade';
import { cn } from '@/lib/cn';
import { X, ArrowRight } from 'lucide-react';

interface GradeDrawerProps {
  fichaId: number;
  localId: number;
  servicoId: number;
  onClose: () => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  conforme:                 { label: 'CONF.',    cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
  nao_conforme:             { label: 'N.CONF.',  cls: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]' },
  excecao:                  { label: 'EXCEP.',   cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
  nao_avaliado:             { label: 'N.AVAL.',  cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
  conforme_apos_reinspecao: { label: 'RE.CONF.', cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
  nc_apos_reinspecao:       { label: 'NC.FINAL', cls: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]' },
  liberado_com_concessao:   { label: 'LIBERAL.', cls: 'bg-yellow-50 text-yellow-800 border border-yellow-200' },
  retrabalho:               { label: 'RETRAB.',  cls: 'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]' },
};

const CRIT_CLS: Record<string, string> = {
  critico: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]',
  maior:   'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
};

export function GradeDrawer({ fichaId, localId, servicoId, onClose }: GradeDrawerProps) {
  const navigate = useNavigate();
  const { data: preview, isLoading } = useGradePreview(fichaId, localId, servicoId);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--bg-base)] border-l border-[var(--border-dim)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div>
            {isLoading ? (
              <div className="h-5 w-40 bg-[var(--bg-raised)] rounded animate-pulse" />
            ) : (
              <>
                <h3 className="text-sm font-semibold text-[var(--text-high)] m-0">
                  {preview?.servico_nome}
                </h3>
                <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">
                  {preview?.local_nome}
                  {preview?.inspetor_nome && ` · ${preview.inspetor_nome}`}
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
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide w-6">#</th>
                  <th className="text-left px-4 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide">Item de Verificação</th>
                  <th className="text-center px-3 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.itens.map((item, idx) => {
                  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.nao_avaliado;
                  const critCls = CRIT_CLS[item.criticidade] ?? CRIT_CLS.menor;
                  return (
                    <tr key={item.id} className={cn(
                      'border-b border-[var(--border-dim)] last:border-0',
                      idx % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                    )}>
                      <td className="px-4 py-2.5 text-[var(--text-faint)] font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0', critCls)}>
                            {item.criticidade.slice(0, 3).toUpperCase()}
                          </span>
                          <span className="text-[var(--text-high)]">{item.descricao}</span>
                        </div>
                        {item.observacao && (
                          <p className="text-[var(--text-faint)] mt-0.5 italic pl-5">{item.observacao}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', badge.cls)}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-dim)] px-5 py-3">
          <button
            onClick={() => {
              navigate(`/fvs/fichas/${fichaId}/inspecao?servicoId=${servicoId}&localId=${localId}`);
              onClose();
            }}
            className="flex items-center gap-2 w-full justify-center px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Ir para inspeção completa <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
