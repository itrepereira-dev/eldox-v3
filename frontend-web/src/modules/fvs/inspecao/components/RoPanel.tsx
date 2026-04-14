// frontend-web/src/modules/fvs/inspecao/components/RoPanel.tsx
import { useRef, useState, useCallback } from 'react';
import { api } from '../../../../services/api';
import {
  useRo,
  usePatchRo,
  usePatchServicoNc,
  useCreateRoEvidencia,
  useDeleteRoEvidencia,
} from '../hooks/useRo';
import type { RoServicoNc } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronUp, Paperclip } from 'lucide-react';

const CAUSA_6M_OPTIONS = [
  { value: '',            label: '— Selecione —' },
  { value: 'mao_obra',    label: 'Mão de Obra' },
  { value: 'maquina',     label: 'Máquina / Equipamento' },
  { value: 'material',    label: 'Material' },
  { value: 'metodo',      label: 'Método' },
  { value: 'medida',      label: 'Medição / Medida' },
  { value: 'meio_ambiente', label: 'Meio Ambiente' },
  { value: 'gestao',      label: 'Gestão' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:     { label: 'Pendente',     cls: 'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]' },
  desbloqueado: { label: 'Desbloqueado', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  verificado:   { label: 'Verificado',   cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
};

const CRIT_BADGE: Record<string, { label: string; cls: string }> = {
  critico: { label: 'Crítico', cls: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]' },
  maior:   { label: 'Maior',   cls: 'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]' },
  menor:   { label: 'Menor',   cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
};

interface RoPanelProps {
  fichaId: number;
  regime: string;
}

interface ServicoAccordionProps {
  servico: RoServicoNc;
  fichaId: number;
}

function ServicoAccordion({ servico, fichaId }: ServicoAccordionProps) {
  const [open, setOpen] = useState(false);
  const [desbloqueioErro, setDesbloqueioErro] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patchServico   = usePatchServicoNc(fichaId);
  const createEvidencia = useCreateRoEvidencia(fichaId);
  const deleteEvidencia = useDeleteRoEvidencia(fichaId);

  const statusInfo = STATUS_BADGE[servico.status] ?? { label: servico.status, cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' };

  async function handleAcaoCorretiva(value: string) {
    await patchServico.mutateAsync({ servicoNcId: servico.id, payload: { acao_corretiva: value || null } });
  }

  async function handleDesbloquear() {
    setDesbloqueioErro(null);
    try {
      await patchServico.mutateAsync({ servicoNcId: servico.id, payload: { desbloquear: true } });
    } catch (e: any) {
      setDesbloqueioErro(e?.response?.data?.message ?? 'Erro ao desbloquear para reinspeção');
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await createEvidencia.mutateAsync({ servicoNcId: servico.id, file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteEvidencia(evidenciaId: number) {
    await deleteEvidencia.mutateAsync({ servicoNcId: servico.id, evidenciaId });
  }

  const handleDownloadEvidencia = useCallback(async (versaoGedId: number) => {
    const { data } = await api.get<{ presignedUrl: string }>(`/ged/versoes/${versaoGedId}/download`);
    window.open(data.presignedUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const textareaCls = 'w-full px-3 py-2 text-sm rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] resize-y transition-colors';

  return (
    <div className="border border-[var(--warn-border)] rounded-lg overflow-hidden">
      {/* Cabeçalho do accordion */}
      <div
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center justify-between px-4 py-3 cursor-pointer transition-colors',
          open ? 'bg-[var(--warn-bg)]' : 'bg-[var(--bg-base)] hover:bg-[var(--bg-hover)]',
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-[var(--text-high)]">{servico.servico_nome}</span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusInfo.cls)}>
            {statusInfo.label}
          </span>
        </div>
        <span className="text-[var(--text-faint)]">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {open && (
        <div className="p-4 border-t border-[var(--warn-border)] bg-[var(--warn-bg)] flex flex-col gap-4">
          {/* Itens NC */}
          {servico.itens && servico.itens.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--warn-text)] uppercase tracking-wide mb-2">
                Itens Não Conformes
              </p>
              <div className="flex flex-col gap-1.5">
                {servico.itens.map(item => {
                  const critInfo = CRIT_BADGE[item.item_criticidade] ?? CRIT_BADGE.menor;
                  return (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', critInfo.cls)}>
                        {critInfo.label}
                      </span>
                      <span className="text-sm text-[var(--text-high)]">{item.item_descricao}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ação Corretiva */}
          <div>
            <label className="block text-[10px] font-semibold text-[var(--warn-text)] uppercase tracking-wide mb-1.5">
              Ação Corretiva
            </label>
            <textarea
              defaultValue={servico.acao_corretiva ?? ''}
              onBlur={e => handleAcaoCorretiva(e.target.value)}
              rows={3}
              placeholder="Descreva a ação corretiva tomada..."
              className={textareaCls}
            />
          </div>

          {/* Evidências */}
          <div>
            <label className="block text-[10px] font-semibold text-[var(--warn-text)] uppercase tracking-wide mb-1.5">
              Evidências
            </label>
            {servico.evidencias && servico.evidencias.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {servico.evidencias.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-base)] border border-[var(--border-dim)]">
                    <button
                      onClick={() => handleDownloadEvidencia(ev.versao_ged_id)}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      {ev.nome_original ?? `Evidência ${ev.id}`}
                    </button>
                    <button
                      onClick={() => handleDeleteEvidencia(ev.id)}
                      disabled={deleteEvidencia.isPending}
                      className="text-[var(--nc-text)] text-sm hover:opacity-70 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                className="hidden"
                accept="image/*,application/pdf"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={createEvidencia.isPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-dashed border-[var(--warn-border)] text-[var(--warn-text)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
              >
                <Paperclip size={11} />
                {createEvidencia.isPending ? 'Enviando...' : 'Adicionar Evidência'}
              </button>
            </div>
          </div>

          {/* Botão desbloquear */}
          {servico.status === 'pendente' && (
            <div>
              {desbloqueioErro && (
                <p className="text-xs text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-2">
                  {desbloqueioErro}
                </p>
              )}
              <button
                onClick={handleDesbloquear}
                disabled={patchServico.isPending}
                className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {patchServico.isPending ? 'Processando...' : 'Desbloquear para Reinspeção'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RoPanel({ fichaId, regime: _regime }: RoPanelProps) {
  const { data: ro, isError, error } = useRo(fichaId);
  const patchRo = usePatchRo(fichaId);

  const isNotFound = (error as any)?.response?.status === 404;
  if (isError && isNotFound) return null;
  if (isError) return null;
  if (!ro) return null;

  const servicos   = ro.servicos ?? [];
  const verificados = servicos.filter(s => s.status === 'verificado').length;
  const total      = servicos.length;

  const selectCls = 'w-full px-3 py-2 text-sm rounded-md border border-[var(--warn-border)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] transition-colors';
  const textareaCls = 'w-full px-3 py-2 text-sm rounded-md border border-[var(--warn-border)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] resize-y transition-colors';

  return (
    <div className="border-2 border-[var(--warn-border)] rounded-xl p-5 bg-[var(--warn-bg)] mt-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-base font-bold text-[var(--warn-text)]">
            Registro de Ocorrência — RO {ro.numero}
          </span>
          <span className={cn(
            'text-[10px] font-bold px-2.5 py-0.5 rounded-full',
            ro.status === 'concluido'
              ? 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]'
              : 'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
          )}>
            {ro.status === 'concluido' ? 'Concluído' : 'Aberto'}
          </span>
        </div>
        <span className="text-sm text-[var(--warn-text)]">
          {verificados}/{total} serviços verificados
        </span>
      </div>

      {/* Campos cabeçalho */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--warn-text)] uppercase tracking-wide mb-1.5">Tipo</label>
          <select value={ro.tipo} onChange={e => patchRo.mutateAsync({ tipo: e.target.value as 'real' | 'potencial' })} className={selectCls}>
            <option value="real">Real</option>
            <option value="potencial">Potencial</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--warn-text)] uppercase tracking-wide mb-1.5">Causa (6M)</label>
          <select value={ro.causa_6m ?? ''} onChange={e => patchRo.mutateAsync({ causa_6m: e.target.value || null })} className={selectCls}>
            {CAUSA_6M_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--warn-text)] uppercase tracking-wide mb-1.5">O que aconteceu</label>
          <textarea
            key={`oqa-${ro.id}`}
            defaultValue={ro.o_que_aconteceu ?? ''}
            onBlur={e => patchRo.mutateAsync({ o_que_aconteceu: e.target.value || null })}
            rows={3}
            placeholder="Descreva o ocorrido..."
            className={textareaCls}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--warn-text)] uppercase tracking-wide mb-1.5">Ação Imediata</label>
          <textarea
            key={`ai-${ro.id}`}
            defaultValue={ro.acao_imediata ?? ''}
            onBlur={e => patchRo.mutateAsync({ acao_imediata: e.target.value || null })}
            rows={3}
            placeholder="Descreva a ação imediata tomada..."
            className={textareaCls}
          />
        </div>
      </div>

      {/* Serviços NC */}
      {servicos.length === 0 ? (
        <p className="text-sm text-[var(--warn-text)]">Nenhum serviço não conforme registrado.</p>
      ) : (
        <div>
          <p className="text-[10px] font-semibold text-[var(--warn-text)] uppercase tracking-wide mb-3">
            Serviços Não Conformes
          </p>
          <div className="flex flex-col gap-2">
            {servicos.map(servico => (
              <ServicoAccordion key={servico.id} servico={servico} fichaId={fichaId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
