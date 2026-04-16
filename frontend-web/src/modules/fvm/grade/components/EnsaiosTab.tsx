// frontend-web/src/modules/fvm/grade/components/EnsaiosTab.tsx
// Aba de Ensaios quantitativos na FichaLotePage

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Plus, FlaskConical, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import {
  useEnsaios,
  useEnsaioTemplates,
  useRegistrarEnsaio,
  useAtualizarEnsaio,
  useRemoverEnsaio,
  useResultadoEnsaios,
} from '../hooks/useGradeFvm';
import { EnsaioCard } from './EnsaioCard';
import type { EnsaioTemplate } from '@/services/fvm.service';

interface EnsaiosTabProps {
  loteId: number;
  materialId: number;
  somenteLeitura?: boolean;
}

export function EnsaiosTab({ loteId, materialId, somenteLeitura }: EnsaiosTabProps) {
  const { data: ensaios = [], isLoading } = useEnsaios(loteId);
  const { data: templates = [] } = useEnsaioTemplates(materialId);
  const { data: resultado } = useResultadoEnsaios(loteId, ensaios.length > 0);

  const registrar   = useRegistrarEnsaio(loteId);
  const atualizar   = useAtualizarEnsaio(loteId);
  const remover     = useRemoverEnsaio(loteId);

  const [addModal, setAddModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EnsaioTemplate | null>(null);
  const [nomeCustom, setNomeCustom] = useState('');
  const [normaCustom, setNormaCustom] = useState('');
  const [unidadeCustom, setUnidadeCustom] = useState('');
  const [valorMinCustom, setValorMinCustom] = useState('');
  const [valorMaxCustom, setValorMaxCustom] = useState('');
  const [modoCustom, setModoCustom] = useState(false); // use template vs custom

  function resetAddForm() {
    setSelectedTemplate(null);
    setNomeCustom('');
    setNormaCustom('');
    setUnidadeCustom('');
    setValorMinCustom('');
    setValorMaxCustom('');
    setModoCustom(false);
  }

  async function adicionarEnsaio() {
    if (selectedTemplate) {
      await registrar.mutateAsync({
        template_id: selectedTemplate.id,
        nome: selectedTemplate.nome,
        norma_referencia: selectedTemplate.norma_referencia ?? undefined,
        unidade: selectedTemplate.unidade,
        valor_min: selectedTemplate.valor_min ?? undefined,
        valor_max: selectedTemplate.valor_max ?? undefined,
      });
    } else {
      if (!nomeCustom.trim() || !unidadeCustom.trim()) return;
      await registrar.mutateAsync({
        nome: nomeCustom.trim(),
        norma_referencia: normaCustom.trim() || undefined,
        unidade: unidadeCustom.trim(),
        valor_min: valorMinCustom ? parseFloat(valorMinCustom) : undefined,
        valor_max: valorMaxCustom ? parseFloat(valorMaxCustom) : undefined,
      });
    }
    setAddModal(false);
    resetAddForm();
  }

  // Templates not yet added to this lote
  const templateIds = new Set(ensaios.map(e => e.template_id).filter(Boolean));
  const templatesDisponiveis = templates.filter(t => !templateIds.has(t.id));

  if (isLoading) {
    return <div className="text-sm text-[var(--text-faint)] py-4 text-center">Carregando ensaios…</div>;
  }

  return (
    <div>
      {/* Auto-result banner */}
      {resultado && ensaios.length > 0 && (
        <div
          className={cn(
            'rounded-lg border p-3 mb-4 flex items-start gap-2',
            resultado.aprovado  && 'border-[var(--ok-border)] bg-[var(--ok-bg)]',
            resultado.reprovado && 'border-[var(--nc-border)] bg-[var(--nc-bg)]',
            !resultado.aprovado && !resultado.reprovado && 'border-[var(--border-dim)] bg-[var(--bg-raised)]',
          )}
        >
          {resultado.aprovado  && <CheckCircle2 size={16} className="text-[var(--ok-text)] mt-0.5 shrink-0" />}
          {resultado.reprovado && <XCircle      size={16} className="text-[var(--nc-text)] mt-0.5 shrink-0" />}
          {!resultado.aprovado && !resultado.reprovado && <AlertCircle size={16} className="text-[var(--warn-text)] mt-0.5 shrink-0" />}

          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-semibold m-0',
              resultado.aprovado  && 'text-[var(--ok-text)]',
              resultado.reprovado && 'text-[var(--nc-text)]',
              !resultado.aprovado && !resultado.reprovado && 'text-[var(--warn-text)]',
            )}>
              {resultado.aprovado  && 'Lote Aprovado nos Ensaios'}
              {resultado.reprovado && 'Lote Reprovado nos Ensaios'}
              {!resultado.aprovado && !resultado.reprovado && `${resultado.pendentes} ensaio(s) pendente(s)`}
            </p>
            {resultado.falhas.length > 0 && (
              <p className="text-xs text-[var(--nc-text)] m-0 mt-0.5">
                Falhas: {resultado.falhas.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Ensaio cards */}
      <div className="flex flex-col gap-2 mb-4">
        {ensaios.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-faint)]">
            <FlaskConical size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm m-0">Nenhum ensaio registrado</p>
            <p className="text-xs m-0 mt-1">Adicione ensaios a partir dos templates ou crie um customizado</p>
          </div>
        ) : (
          ensaios.map((ensaio) => (
            <EnsaioCard
              key={ensaio.id}
              ensaio={ensaio}
              somenteLeitura={somenteLeitura}
              onAtualizar={async (valor, laboratorio) => {
                await atualizar.mutateAsync({
                  ensaioId: ensaio.id,
                  payload: { valor_medido: valor, laboratorio_nome: laboratorio },
                });
              }}
              onRemover={async () => {
                await remover.mutateAsync(ensaio.id);
              }}
            />
          ))
        )}
      </div>

      {/* Add button */}
      {!somenteLeitura && (
        <button
          onClick={() => setAddModal(true)}
          className="w-full py-2 rounded-lg border border-dashed border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Adicionar Ensaio
        </button>
      )}

      {/* Add modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-[var(--bg-base)] rounded-xl border border-[var(--border-dim)] shadow-2xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3">Adicionar Ensaio</h3>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-[var(--border-dim)] overflow-hidden mb-3 text-xs font-medium">
              <button
                type="button"
                onClick={() => { setModoCustom(false); setSelectedTemplate(null); }}
                className={cn(
                  'flex-1 py-1.5',
                  !modoCustom ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-faint)] bg-[var(--bg-raised)]',
                )}
              >
                Por Template
              </button>
              <button
                type="button"
                onClick={() => setModoCustom(true)}
                className={cn(
                  'flex-1 py-1.5',
                  modoCustom ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-faint)] bg-[var(--bg-raised)]',
                )}
              >
                Customizado
              </button>
            </div>

            {!modoCustom ? (
              /* Template picker */
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto mb-4">
                {templatesDisponiveis.length === 0 ? (
                  <p className="text-xs text-[var(--text-faint)] text-center py-3">
                    Todos os templates já foram adicionados
                  </p>
                ) : (
                  templatesDisponiveis.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplate(t)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md border text-sm transition-colors',
                        selectedTemplate?.id === t.id
                          ? 'border-[var(--accent)] bg-[var(--bg-raised)] text-[var(--text-high)]'
                          : 'border-[var(--border-dim)] text-[var(--text-faint)] hover:border-[var(--accent)]',
                      )}
                    >
                      <div className="font-medium">{t.nome}</div>
                      {t.norma_referencia && <div className="text-[10px] opacity-70">{t.norma_referencia}</div>}
                      <div className="text-[10px] mt-0.5">
                        {[t.valor_min != null ? `≥ ${t.valor_min}` : null, t.valor_max != null ? `≤ ${t.valor_max}` : null].filter(Boolean).join(', ')} {t.unidade}
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* Custom form */
              <div className="flex flex-col gap-2 mb-4">
                <input
                  type="text"
                  value={nomeCustom}
                  onChange={e => setNomeCustom(e.target.value)}
                  placeholder="Nome do ensaio *"
                  className="w-full text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={normaCustom}
                    onChange={e => setNormaCustom(e.target.value)}
                    placeholder="Norma (ex: NBR 15270)"
                    className="flex-1 text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    type="text"
                    value={unidadeCustom}
                    onChange={e => setUnidadeCustom(e.target.value)}
                    placeholder="Unidade *"
                    className="w-20 text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={valorMinCustom}
                    onChange={e => setValorMinCustom(e.target.value)}
                    placeholder="Valor mín"
                    step="any"
                    className="flex-1 text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    type="number"
                    value={valorMaxCustom}
                    onChange={e => setValorMaxCustom(e.target.value)}
                    placeholder="Valor máx"
                    step="any"
                    className="flex-1 text-sm px-3 py-2 rounded-md border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setAddModal(false); resetAddForm(); }}
                className="flex-1 py-2 rounded-md border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)]"
              >
                Cancelar
              </button>
              <button
                onClick={adicionarEnsaio}
                disabled={registrar.isPending || (!selectedTemplate && (!nomeCustom.trim() || !unidadeCustom.trim()))}
                className="flex-1 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {registrar.isPending ? 'Adicionando…' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
