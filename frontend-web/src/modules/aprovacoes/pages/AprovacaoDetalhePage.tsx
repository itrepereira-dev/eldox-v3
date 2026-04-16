import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  UserCheck,
  Ban,
  RefreshCw,
  Clock,
  Building,
  User,
  Calendar,
  Tag,
} from 'lucide-react';
import { useAprovacao, useCancelar, useReabrir } from '../hooks/useAprovacoes';
import { AprovacaoStatusBadge } from '../components/AprovacaoStatusBadge';
import { DecidirModal } from '../components/DecidirModal';
import { DelegarModal } from '../components/DelegarModal';
import { SnapshotViewer } from '../components/SnapshotViewer';
import type { AprovacaoDecisao, AprovacaoInstancia } from '../../../services/aprovacoes.service';

// ── Utilitários ───────────────────────────────────────────────────────────────

function formatDataHora(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDataCurta(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit',
  });
}

// ── Barra de progresso das etapas ─────────────────────────────────────────────

function ProgressoEtapas({ aprovacao }: { aprovacao: AprovacaoInstancia }) {
  const etapas = aprovacao.template?.etapas ?? [];
  if (etapas.length === 0) return null;
  const etapaAtual = aprovacao.etapaAtual ?? 0;

  return (
    <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-raised)] p-5 mb-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-4">
        Progresso das Etapas
      </h3>
      <div className="flex items-center gap-0 overflow-x-auto">
        {etapas.map((etapa, idx) => {
          const numero = idx + 1;
          const isConcluida = aprovacao.status === 'APROVADO' || numero < etapaAtual;
          const isAtual = numero === etapaAtual;
          void (numero > etapaAtual); // isPendente — reserved for future use

          let circleStyle: React.CSSProperties = {};
          let labelColor = 'var(--text-faint)';

          if (isConcluida) {
            circleStyle = { background: 'var(--ok)', color: 'var(--bg-void)', border: 'none' };
            labelColor = 'var(--ok-text)';
          } else if (isAtual) {
            circleStyle = { background: 'var(--warn-bg)', color: 'var(--warn-text)', border: '2px solid var(--warn)' };
            labelColor = 'var(--warn-text)';
          } else {
            circleStyle = { background: 'var(--bg-hover)', color: 'var(--text-faint)', border: '2px solid var(--border-dim)' };
          }

          return (
            <div key={etapa.id ?? idx} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
                <div
                  className="flex items-center justify-center rounded-full text-xs font-bold mb-1.5"
                  style={{ width: 32, height: 32, ...circleStyle }}
                >
                  {isConcluida ? '✓' : numero}
                </div>
                <span
                  className="text-[10px] font-semibold text-center leading-tight max-w-[70px]"
                  style={{ color: labelColor }}
                >
                  {etapa.nome}
                </span>
              </div>
              {idx < etapas.length - 1 && (
                <div
                  className="h-0.5 flex-shrink-0"
                  style={{
                    width: 32,
                    background: isConcluida ? 'var(--ok)' : 'var(--border-dim)',
                    marginTop: -20,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Timeline de decisões ──────────────────────────────────────────────────────

const DECISAO_CONFIG: Record<string, { label: string; cor: string; icon: string }> = {
  CRIADA:    { label: 'Criada',    cor: 'var(--run)',  icon: '●' },
  APROVADO:  { label: 'Aprovado',  cor: 'var(--ok)',   icon: '✓' },
  REPROVADO: { label: 'Reprovado', cor: 'var(--nc)',   icon: '✗' },
  DELEGADO:  { label: 'Delegado',  cor: 'var(--run)',  icon: '→' },
  CANCELADO: { label: 'Cancelado', cor: 'var(--off)',  icon: '×' },
  REABERTO:  { label: 'Reaberto',  cor: 'var(--warn)', icon: '↺' },
  ESCALADO:  { label: 'Escalado',  cor: 'var(--warn)', icon: '▲' },
  AVANCADO:  { label: 'Avançado',  cor: 'var(--run)',  icon: '▶' },
};

function TimelineDecisoes({ decisoes }: { decisoes: AprovacaoDecisao[] }) {
  if (!decisoes || decisoes.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-raised)] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-4">
        Histórico de Decisões
      </h3>
      <div className="relative">
        {/* Linha vertical */}
        <div
          className="absolute top-0 bottom-0 left-[15px]"
          style={{ width: 2, background: 'var(--border-dim)', zIndex: 0 }}
        />
        <div className="space-y-4">
          {decisoes.map((d, i) => {
            const cfg = DECISAO_CONFIG[d.tipo] ?? DECISAO_CONFIG['CRIADA'];
            return (
              <div key={d.id ?? i} className="flex items-start gap-3 relative">
                {/* Marcador */}
                <div
                  className="flex items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0 z-10"
                  style={{
                    width: 30,
                    height: 30,
                    background: `${cfg.cor}20`,
                    color: cfg.cor,
                    border: `2px solid ${cfg.cor}`,
                  }}
                >
                  {cfg.icon}
                </div>
                {/* Conteúdo */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: cfg.cor }}>
                      {cfg.label}
                    </span>
                    {d.etapaOrdem != null && (
                      <span className="text-[10px] text-[var(--text-faint)]">
                        — Etapa {d.etapaOrdem}
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--text-faint)] ml-auto">
                      {formatDataCurta(d.criadoEm)}{' '}
                      {new Date(d.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {d.aprovador && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <User size={10} className="text-[var(--text-faint)]" />
                      <span className="text-xs text-[var(--text-mid)]">{d.aprovador.nome}</span>
                    </div>
                  )}
                  {d.observacao && (
                    <div className="mt-1.5 px-3 py-2 rounded-md text-xs text-[var(--text-mid)] bg-[var(--bg-hover)] border-l-2" style={{ borderColor: cfg.cor }}>
                      "{d.observacao}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Info Row ──────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border-dim)] last:border-0">
      <div className="flex items-center justify-center rounded-md flex-shrink-0 mt-0.5"
        style={{ width: 28, height: 28, background: 'var(--bg-hover)' }}>
        <Icon size={13} className="text-[var(--text-faint)]" />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
        <div className="text-sm text-[var(--text-high)] mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function AprovacaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const aprovacaoId = Number(id);

  const { data: aprovacao, isLoading } = useAprovacao(aprovacaoId);
  const cancelar = useCancelar();
  const reabrir = useReabrir();

  const [showDecidir, setShowDecidir] = useState(false);
  const [showDelegar, setShowDelegar] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  if (!aprovacao) {
    return (
      <div className="p-6">
        <p className="text-[var(--text-faint)] text-sm">Aprovação não encontrada.</p>
      </div>
    );
  }

  const podeDecidir = aprovacao.status === 'EM_APROVACAO';
  const podeDelegar = aprovacao.status === 'PENDENTE' || aprovacao.status === 'EM_APROVACAO';
  const podeCancelar = aprovacao.status === 'PENDENTE' || aprovacao.status === 'EM_APROVACAO';
  const podeReabrir = aprovacao.status === 'REPROVADO';

  return (
    <div className="p-6" style={{ background: 'var(--bg-void)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ── Breadcrumb ────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate('/aprovacoes')}
          className="flex items-center gap-1.5 text-sm text-[var(--text-faint)] hover:text-[var(--text-mid)] mb-5 transition-colors"
        >
          <ArrowLeft size={14} />
          Aprovações
          <span className="text-[var(--border-dim)]">/</span>
          <span className="text-[var(--text-mid)] truncate max-w-[200px]">{aprovacao.titulo}</span>
        </button>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <AprovacaoStatusBadge status={aprovacao.status} />
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                style={{ background: 'var(--accent-dim,rgba(240,136,62,.12))', color: 'var(--accent)' }}
              >
                {aprovacao.modulo}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-high)] leading-tight">
              {aprovacao.titulo}
            </h1>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-2 flex-wrap">
            {podeDecidir && (
              <>
                <button
                  onClick={() => setShowDecidir(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--ok)' }}
                >
                  <CheckCircle size={14} />
                  Aprovar
                </button>
                <button
                  onClick={() => setShowDecidir(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--nc)' }}
                >
                  <XCircle size={14} />
                  Reprovar
                </button>
              </>
            )}
            {podeDelegar && (
              <button
                onClick={() => setShowDelegar(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--border-dim)] text-sm font-medium text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <UserCheck size={14} />
                Delegar
              </button>
            )}
            {podeCancelar && (
              <button
                onClick={() => {
                  if (confirm('Confirmar cancelamento desta aprovação?')) {
                    cancelar.mutate({ id: aprovacaoId });
                  }
                }}
                disabled={cancelar.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--border-dim)] text-sm font-medium text-[var(--text-faint)] hover:text-[var(--nc)] hover:border-[var(--nc)] transition-colors"
              >
                <Ban size={14} />
                Cancelar
              </button>
            )}
            {podeReabrir && (
              <button
                onClick={() => reabrir.mutate(aprovacaoId)}
                disabled={reabrir.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--warn)', color: 'var(--warn-text)', background: 'var(--warn-bg)' }}
              >
                <RefreshCw size={14} />
                Reabrir
              </button>
            )}
          </div>
        </div>

        {/* ── Progresso das Etapas ──────────────────────────────────────── */}
        <ProgressoEtapas aprovacao={aprovacao} />

        {/* ── Informações ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* Coluna 1 */}
          <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-raised)] px-5 py-3">
            <InfoRow icon={Tag}      label="Módulo"     value={aprovacao.modulo} />
            <InfoRow icon={Tag}      label="Template"   value={aprovacao.template?.nome ?? '—'} />
            <InfoRow icon={Building} label="Obra"       value={aprovacao.obra?.nome ?? '—'} />
          </div>
          {/* Coluna 2 */}
          <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-raised)] px-5 py-3">
            <InfoRow
              icon={User}
              label="Solicitante"
              value={aprovacao.solicitante?.nome ?? '—'}
            />
            <InfoRow
              icon={Calendar}
              label="Criado em"
              value={formatDataHora(aprovacao.criadoEm)}
            />
            <InfoRow
              icon={Clock}
              label="Prazo"
              value={aprovacao.prazo ? new Date(aprovacao.prazo).toLocaleDateString('pt-BR') : '—'}
            />
          </div>
        </div>

        {/* ── Aprovador atual ───────────────────────────────────────────── */}
        {aprovacao.aprovadorAtual && (
          <div
            className="rounded-xl border p-4 mb-5 flex items-center gap-3"
            style={{ borderColor: 'var(--run-border)', background: 'var(--run-bg)' }}
          >
            <div
              className="flex items-center justify-center rounded-full text-sm font-bold"
              style={{ width: 36, height: 36, background: 'var(--run)', color: 'var(--bg-void)', flexShrink: 0 }}
            >
              {aprovacao.aprovadorAtual.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--run-text)] opacity-70">
                Aguardando aprovação de
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--run-text)' }}>
                {aprovacao.aprovadorAtual.nome}
              </div>
              <div className="text-xs" style={{ color: 'var(--run-text)', opacity: 0.7 }}>
                {aprovacao.aprovadorAtual.email}
              </div>
            </div>
          </div>
        )}

        {/* ── Snapshot do Registro ──────────────────────────────────────── */}
        {aprovacao.snapshotJson && Object.keys(aprovacao.snapshotJson).length > 0 && (
          <div className="mb-5">
            <SnapshotViewer snapshot={aprovacao.snapshotJson} />
          </div>
        )}

        {/* ── Histórico ─────────────────────────────────────────────────── */}
        {aprovacao.decisoes && aprovacao.decisoes.length > 0 && (
          <TimelineDecisoes decisoes={aprovacao.decisoes} />
        )}

      </div>

      {/* ── Modais ───────────────────────────────────────────────────────── */}
      {showDecidir && (
        <DecidirModal
          aprovacaoId={aprovacaoId}
          onClose={() => setShowDecidir(false)}
        />
      )}
      {showDelegar && (
        <DelegarModal
          aprovacaoId={aprovacaoId}
          onClose={() => setShowDelegar(false)}
        />
      )}
    </div>
  );
}
