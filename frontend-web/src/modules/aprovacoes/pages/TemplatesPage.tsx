import { useState } from 'react';
import { Plus, Pencil, PowerOff, CheckCircle2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTemplates, useCriarTemplate, useAtualizarTemplate, useDesativarTemplate } from '../hooks/useTemplates';
import { TemplateEditor } from '../components/TemplateEditor';
import type { WorkflowTemplate, AprovacaoModulo } from '../../../services/aprovacoes.service';

const MODULO_LABEL: Record<AprovacaoModulo, string> = {
  FVS:          'FVS',
  FVM:          'FVM',
  RDO:          'RDO',
  NC:           'NC',
  GED:          'GED',
  ENSAIO:       'Ensaio',
  CONCRETAGEM:  'Concretagem',
  ALMOXARIFADO: 'Almoxarifado',
};

type ModalState =
  | { tipo: 'nenhum' }
  | { tipo: 'criar' }
  | { tipo: 'editar'; template: WorkflowTemplate };

export function TemplatesPage() {
  const { data: templates = [], isLoading } = useTemplates();
  const criar = useCriarTemplate();
  const atualizar = useAtualizarTemplate();
  const desativar = useDesativarTemplate();

  const [modal, setModal] = useState<ModalState>({ tipo: 'nenhum' });

  const handleSalvar = (data: Partial<WorkflowTemplate>) => {
    if (modal.tipo === 'criar') {
      criar.mutate(data, { onSuccess: () => setModal({ tipo: 'nenhum' }) });
    } else if (modal.tipo === 'editar') {
      atualizar.mutate(
        { id: modal.template.id, dto: data },
        { onSuccess: () => setModal({ tipo: 'nenhum' }) },
      );
    }
  };

  const salvando = criar.isPending || atualizar.isPending;

  return (
    <div className="p-6" style={{ background: 'var(--bg-void)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 36, height: 36, background: 'var(--run-bg)', border: '1px solid var(--run-border)' }}
            >
              <Settings2 size={18} style={{ color: 'var(--run)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-high)] tracking-tight m-0">
                Templates de Aprovação
              </h1>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                Configure os fluxos de aprovação do tenant
              </p>
            </div>
          </div>
          <button
            onClick={() => setModal({ tipo: 'criar' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Novo Template
          </button>
        </div>

        {/* ── Tabela ───────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-sm text-[var(--text-faint)]">
            Carregando templates...
          </div>
        )}

        {!isLoading && (templates as WorkflowTemplate[]).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border-dim)] rounded-xl">
            <Settings2 size={32} className="text-[var(--border-dim)] mb-3" />
            <p className="text-sm text-[var(--text-faint)] mb-3">
              Nenhum template configurado ainda.
            </p>
            <button
              onClick={() => setModal({ tipo: 'criar' })}
              className="text-sm text-[var(--accent)] border border-[var(--accent)] rounded-lg px-4 py-1.5 hover:bg-[var(--accent-dim,rgba(240,136,62,.1))] transition-colors"
            >
              Criar primeiro template
            </button>
          </div>
        )}

        {!isLoading && (templates as WorkflowTemplate[]).length > 0 && (
          <div className="rounded-xl border border-[var(--border-dim)] overflow-hidden">
            {/* Header */}
            <div
              className="grid text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] px-4 py-2.5 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]"
              style={{ gridTemplateColumns: '1fr 100px 80px 80px 100px' }}
            >
              <span>Nome</span>
              <span>Módulo</span>
              <span>Etapas</span>
              <span>Ativo</span>
              <span className="text-right">Ações</span>
            </div>

            {(templates as WorkflowTemplate[]).map((t, i) => (
              <div
                key={t.id}
                className={cn(
                  'grid items-center px-4 py-3 border-b border-[var(--border-dim)] last:border-0 transition-colors',
                  i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                )}
                style={{ gridTemplateColumns: '1fr 100px 80px 80px 100px' }}
              >
                <div>
                  <div className="text-sm font-semibold text-[var(--text-high)]">{t.nome}</div>
                  {t.descricao && (
                    <div className="text-xs text-[var(--text-faint)] mt-0.5 truncate max-w-xs">
                      {t.descricao}
                    </div>
                  )}
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded uppercase w-fit"
                  style={{ background: 'var(--accent-dim,rgba(240,136,62,.12))', color: 'var(--accent)' }}
                >
                  {MODULO_LABEL[t.modulo] ?? t.modulo}
                </span>
                <span className="text-sm text-[var(--text-faint)]">
                  {t.etapas?.length ?? 0} etapa{(t.etapas?.length ?? 0) !== 1 ? 's' : ''}
                </span>
                <div>
                  {t.ativo ? (
                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--ok-text)' }}>
                      <CheckCircle2 size={12} />
                      Ativo
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--text-faint)]">Inativo</span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setModal({ tipo: 'editar', template: t })}
                    className="flex items-center gap-1 text-xs text-[var(--text-mid)] hover:text-[var(--accent)] transition-colors"
                    title="Editar"
                  >
                    <Pencil size={12} />
                    Editar
                  </button>
                  {t.ativo && (
                    <button
                      onClick={() => {
                        if (confirm(`Desativar o template "${t.nome}"?`)) {
                          desativar.mutate(t.id);
                        }
                      }}
                      disabled={desativar.isPending}
                      className="flex items-center gap-1 text-xs text-[var(--text-faint)] hover:text-[var(--nc)] transition-colors"
                      title="Desativar"
                    >
                      <PowerOff size={12} />
                      Desativar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── Modal criar / editar ────────────────────────────────────────── */}
      {modal.tipo !== 'nenhum' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 py-8 px-4 overflow-y-auto">
          <div
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-xl shadow-xl w-full"
            style={{ maxWidth: 680 }}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
              <h2 className="text-base font-semibold text-[var(--text-high)]">
                {modal.tipo === 'criar' ? 'Novo Template' : `Editar: ${modal.template.nome}`}
              </h2>
              <button
                onClick={() => setModal({ tipo: 'nenhum' })}
                className="text-xl text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <TemplateEditor
                template={modal.tipo === 'editar' ? modal.template : undefined}
                onSalvar={handleSalvar}
                salvando={salvando}
                onCancelar={() => setModal({ tipo: 'nenhum' })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
