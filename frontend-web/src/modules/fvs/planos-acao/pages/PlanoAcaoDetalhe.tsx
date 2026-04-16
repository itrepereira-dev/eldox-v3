// frontend-web/src/modules/fvs/planos-acao/pages/PlanoAcaoDetalhe.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ExternalLink, Calendar, User,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePlanoAcao } from '../hooks/usePlanosAcao';
import { PaStagePipeline } from '../components/PaStagePipeline';
import { PaHistoryTimeline } from '../components/PaHistoryTimeline';
import { PaDynamicFields } from '../components/PaDynamicFields';
import { TransicaoModal } from '../components/TransicaoModal';
import type { PaConfigEtapa } from '../../../../services/planos-acao.service';

const PRIORIDADE_STYLES: Record<string, string> = {
  BAIXA:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  MEDIA:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ALTA:    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CRITICA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function PlanoAcaoDetalhe() {
  const { obraId, paId } = useParams<{ obraId: string; paId: string }>();
  const numericPaId = Number(paId);
  const numericObraId = Number(obraId);

  const { data: pa, isLoading, isError } = usePlanoAcao(numericPaId);
  const [showTransicao, setShowTransicao] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm animate-pulse">
        Carregando PA…
      </div>
    );
  }

  if (isError || !pa) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500 text-sm">
        PA não encontrado.
      </div>
    );
  }

  // Stages after the current one (excluding current) for transition options
  const etapasOrdenadas: PaConfigEtapa[] = [...(pa.etapas_ciclo ?? [])].sort((a, b) => a.ordem - b.ordem);
  const idxAtual = etapasOrdenadas.findIndex((e) => e.id === pa.etapa_atual_id);
  // Allow going to any stage that's not the current one (forward or backward)
  const etapasDisponiveis = etapasOrdenadas.filter((_, i) => i !== idxAtual);

  const origemLink =
    pa.origem_tipo === 'INSPECAO_FVS' && pa.origem_id
      ? `/fvs/fichas/${pa.origem_id}`
      : pa.origem_tipo === 'NC_FVS' && pa.origem_id
      ? `/obras/${numericObraId}/ncs/${pa.origem_id}`
      : null;

  const isFechado = !!pa.fechado_em;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        to={`/obras/${numericObraId}/fvs/planos-acao`}
        className="flex items-center gap-1.5 text-[13px] text-[var(--text-faint)] hover:text-[var(--text-high)] w-fit"
      >
        <ArrowLeft size={14} /> Planos de Ação
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[12px] font-mono text-[var(--text-faint)]">{pa.numero}</span>
            <span
              className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
                PRIORIDADE_STYLES[pa.prioridade] ?? PRIORIDADE_STYLES.MEDIA,
              )}
            >
              {pa.prioridade}
            </span>
            {isFechado && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                Encerrado
              </span>
            )}
          </div>
          <h1 className="text-[22px] font-bold text-[var(--text-high)]">{pa.titulo}</h1>

          {/* Origin link */}
          {origemLink && (
            <Link
              to={origemLink}
              className="flex items-center gap-1 text-[12px] text-[var(--accent)] mt-1 hover:underline"
            >
              <ExternalLink size={12} />
              {pa.origem_tipo === 'INSPECAO_FVS' ? `Inspeção #${pa.origem_id}` : `NC #${pa.origem_id}`}
            </Link>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 mt-2 text-[12px] text-[var(--text-faint)] flex-wrap">
            {pa.responsavel_id && (
              <span className="flex items-center gap-1"><User size={12} />Resp. #{pa.responsavel_id}</span>
            )}
            {pa.prazo && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Prazo: {new Date(pa.prazo).toLocaleDateString('pt-BR')}
              </span>
            )}
            <span>Aberto em {new Date(pa.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Advance button */}
        {!isFechado && etapasDisponiveis.length > 0 && (
          <button
            onClick={() => setShowTransicao(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 flex-shrink-0"
          >
            {pa.etapa_is_final ? 'Encerrar PA' : 'Avançar'}
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Stage pipeline */}
      {etapasOrdenadas.length > 0 && (
        <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-4">Etapas do Ciclo</h2>
          <PaStagePipeline etapas={etapasOrdenadas} etapaAtualId={pa.etapa_atual_id} />
        </div>
      )}

      {/* Description */}
      {pa.descricao && (
        <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-2">Descrição</h2>
          <p className="text-[13px] text-[var(--text-medium)] whitespace-pre-wrap">{pa.descricao}</p>
        </div>
      )}

      {/* Dynamic fields for current stage */}
      {(pa.campos_etapa_atual?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-3">
            Campos da Etapa Atual — {pa.etapa_nome}
          </h2>
          <PaDynamicFields
            campos={pa.campos_etapa_atual!}
            values={pa.campos_extras}
            onChange={() => {/* read-only view; edit via transição */ }}
            readOnly
          />
        </div>
      )}

      {/* History timeline */}
      <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-4">Histórico</h2>
        <PaHistoryTimeline historico={pa.historico ?? []} />
      </div>

      {/* Transition modal */}
      {showTransicao && (
        <TransicaoModal
          pa={pa}
          etapasProximas={etapasDisponiveis}
          onClose={() => setShowTransicao(false)}
        />
      )}
    </div>
  );
}
