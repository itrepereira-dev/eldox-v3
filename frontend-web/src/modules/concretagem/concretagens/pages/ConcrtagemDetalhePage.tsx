// frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx
// Detalhe de Concretagem com caminhões e CPs — Sprint 8 (renomeado de Betonada)
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, FlaskConical, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StatusConcretagem, StatusCaminhao, StatusCp } from '@/services/concretagem.service';
import { useBuscarConcretagem, useConcluirCaminhao, useToggleLiberado, useSetLacre } from '../hooks/useConcretagens';
import { useListarCroquis, useBuscarCroqui } from '../../croqui/hooks/useCroqui';
import { LaudosSection } from '../../laudos/pages/LaudosPage';
import { RacsSection } from '../../racs/pages/RacsPage';
import CaminhaoModal from '../components/CaminhaoModal';
import SlumpModal from '../components/SlumpModal';
import RejeitarCaminhaoModal from '../components/RejeitarCaminhaoModal';
import MoldagemCpModal from '../components/MoldagemCpModal';
import RupturaModal from '../components/RupturaModal';

// ── Labels e cores ─────────────────────────────────────────────────────────────

const BET_LABELS: Record<StatusConcretagem, string> = {
  PROGRAMADA: 'Programada',
  EM_LANCAMENTO: 'Em Lançamento',
  EM_RASTREABILIDADE: 'Em Rastreabilidade',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};
const BET_COLORS: Record<StatusConcretagem, string> = {
  PROGRAMADA: 'bg-[var(--accent-dim)] text-[var(--accent)]',
  EM_LANCAMENTO: 'bg-[var(--warn-dim)] text-[var(--warn-text)]',
  EM_RASTREABILIDADE: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  CONCLUIDA: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  CANCELADA: 'bg-[var(--bg-raised)] text-[var(--text-faint)]',
};

const CAM_LABELS: Record<StatusCaminhao, string> = {
  CHEGOU: 'Chegou', EM_LANCAMENTO: 'Em Lançamento', CONCLUIDO: 'Concluído', REJEITADO: 'Rejeitado',
};
const CAM_COLORS: Record<StatusCaminhao, string> = {
  CHEGOU: 'bg-[var(--accent-dim)] text-[var(--accent)]',
  EM_LANCAMENTO: 'bg-[var(--warn-dim)] text-[var(--warn-text)]',
  CONCLUIDO: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  REJEITADO: 'bg-[var(--nc-dim)] text-[var(--nc-text)]',
};

const CP_LABELS: Record<StatusCp, string> = {
  AGUARDANDO_RUPTURA: 'Aguardando', ROMPIDO_APROVADO: 'Aprovado', ROMPIDO_REPROVADO: 'Reprovado', CANCELADO: 'Cancelado',
};
const CP_COLORS: Record<StatusCp, string> = {
  AGUARDANDO_RUPTURA: 'bg-[var(--accent-dim)] text-[var(--accent)]',
  ROMPIDO_APROVADO: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  ROMPIDO_REPROVADO: 'bg-[var(--nc-dim)] text-[var(--nc-text)]',
  CANCELADO: 'bg-[var(--bg-raised)] text-[var(--text-faint)]',
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-6 w-48 bg-[var(--bg-raised)] rounded" />
      <div className="h-4 w-96 bg-[var(--bg-raised)] rounded" />
      <div className="h-32 w-full bg-[var(--bg-raised)] rounded" />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConcrtagemDetalhePage() {
  const { obraId, concrtagemId } = useParams<{ obraId: string; concrtagemId: string }>();
  const navigate = useNavigate();
  const obraIdNum       = Number(obraId) || 0;
  const concrtagemIdNum = Number(concrtagemId) || 0;

  const { data, isLoading, isError, refetch } = useBuscarConcretagem(obraIdNum, concrtagemIdNum);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [caminhaoModal, setCaminhaoModal] = useState(false);
  const [slumpModal, setSlumpModal] = useState<{ caminhaoId: number } | null>(null);
  const [rejeitarModal, setRejeitarModal] = useState<{ caminhaoId: number; sequencia: number } | null>(null);
  const [cpModal, setCpModal] = useState(false);
  const [rupturaModal, setRupturaModal] = useState<{ cpId: number; numero: string; idadeDias: number } | null>(null);

  const concluirCaminhao = useConcluirCaminhao(obraIdNum, concrtagemIdNum);
  const toggleLiberado = useToggleLiberado(obraIdNum, concrtagemIdNum);
  const setLacre = useSetLacre(obraIdNum, concrtagemIdNum);

  // Croqui elements for multi-select in CaminhaoModal
  const { data: croquis } = useListarCroquis(obraIdNum);
  const primeiroCroquiId = croquis?.[0]?.id ?? 0;
  const { data: croquiDetalhe } = useBuscarCroqui(obraIdNum, primeiroCroquiId);
  const elementosDisponiveis = croquiDetalhe?.elementos.elementos.map((e) => e.label) ?? [];

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-[var(--nc-text)]">Concretagem não encontrada</p>
      </div>
    );
  }

  const formatData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const concrtagemAtiva = data.status !== 'CANCELADA' && data.status !== 'CONCLUIDA';

  const caminhoesMoldagem = data.caminhoes
    .filter((c) => c.status === 'CONCLUIDO' || c.status === 'EM_LANCAMENTO')
    .map((c) => ({ id: c.id, sequencia: c.sequencia, numero_nf: c.numero_nf }));

  return (
    <div className="p-6 space-y-8">

      {/* Breadcrumb / Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate(`/obras/${obraIdNum}/concretagem/concretagens`)}
          className="flex items-center gap-1.5 text-sm text-[var(--text-faint)] hover:text-[var(--accent)] mb-3"
        >
          <ArrowLeft size={14} />
          Concretagens
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">{data.numero}</h1>
            <p className="text-sm text-[var(--text-faint)] mt-0.5">{data.elemento_estrutural}</p>
          </div>
          <span className={cn('px-3 py-1 rounded text-sm font-medium', BET_COLORS[data.status])}>
            {BET_LABELS[data.status]}
          </span>
        </div>
      </div>

      {/* Info geral */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Volume Previsto', value: `${Number(data.volume_previsto).toFixed(1)} m³` },
          { label: 'fck Especificado', value: `${data.fck_especificado} MPa` },
          { label: 'Data Programada', value: formatData(data.data_programada) },
          { label: 'Traço', value: data.traco_especificado ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-faint)] mb-1">{label}</p>
            <p className="text-sm font-semibold text-[var(--text-high)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Liberado para Carregamento */}
      {data.status === 'PROGRAMADA' && (
        <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-surface)' }}>
          <button
            type="button"
            disabled={toggleLiberado.isPending}
            onClick={() => void toggleLiberado.mutateAsync()}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
            style={{ background: data.liberado_carregamento ? 'var(--ok-text)' : 'var(--bg-raised)', border: '2px solid var(--border-dim)' }}
          >
            <span
              className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              style={{ transform: data.liberado_carregamento ? 'translateX(20px)' : 'translateX(2px)' }}
            />
          </button>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-high)' }}>
              {data.liberado_carregamento ? '✓ Liberado Para Carregamento' : 'Aguardando Liberação'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
              {data.liberado_carregamento ? 'Usina pode iniciar o carregamento' : 'Aguardando confirmação da obra'}
            </p>
          </div>
          {data.bombeado && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              Bombeado
            </span>
          )}
        </div>
      )}

      {/* Caminhões */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
          <Truck size={16} />
          Caminhões ({data.caminhoes.length})
          {concrtagemAtiva && (
            <button
              type="button"
              onClick={() => setCaminhaoModal(true)}
              className="ml-auto text-xs px-3 py-1 rounded-lg font-medium"
              style={{ background: 'var(--accent)', color: 'var(--text-high)' }}
            >
              + Registrar Chegada
            </button>
          )}
        </h2>
        {data.caminhoes.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">Nenhum caminhão registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-dim)]">
                  {['#', 'NF', 'Volume', 'Slump', 'Status', 'Lacre', 'Sobra', 'NF', 'Ações'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[var(--text-faint)] font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.caminhoes.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)]">
                    <td className="px-3 py-2 text-[var(--text-faint)]">{c.sequencia}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--text-high)]">{c.numero_nf}</td>
                    <td className="px-3 py-2 text-[var(--text-med)]">{Number(c.volume).toFixed(1)} m³</td>
                    <td className="px-3 py-2 text-[var(--text-med)] text-xs">
                      {c.slump_especificado != null ? `${c.slump_especificado}` : '—'} / {c.slump_medido != null ? `${c.slump_medido}` : '—'} cm
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', CAM_COLORS[c.status])}>
                        {CAM_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {c.lacre_aprovado === true ? (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--ok-dim)', color: 'var(--ok-text)' }}>✓ OK</span>
                      ) : c.lacre_aprovado === false ? (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--nc-dim)', color: 'var(--nc-text)' }}>✗ Rep.</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {c.sobra_tipo ? (
                        <span className="text-xs" style={{ color: c.sobra_tipo === 'NAO_PAGAR' ? 'var(--warn-text)' : 'var(--text-med)' }}>
                          {c.sobra_tipo === 'APROVEITADO' ? 'Aprov.' : c.sobra_tipo === 'DESCARTADO' ? 'Desc.' : 'N.Pagar'}
                          {c.sobra_volume ? ` ${Number(c.sobra_volume).toFixed(1)}m³` : ''}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {c.nf_vencida ? (
                        <XCircle size={14} className="text-[var(--nc-text)]" />
                      ) : (
                        <CheckCircle size={14} className="text-[var(--ok-text)]" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {c.status === 'CHEGOU' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSlumpModal({ caminhaoId: c.id })}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                          >
                            Slump
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejeitarModal({ caminhaoId: c.id, sequencia: c.sequencia })}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: 'var(--nc-dim)', color: 'var(--nc-text)' }}
                          >
                            Rejeitar
                          </button>
                          {c.lacre_aprovado === null && (
                            <button
                              type="button"
                              onClick={() => {
                                void setLacre.mutateAsync({ caminhaoId: c.id, aprovado: true });
                              }}
                              className="text-xs px-2 py-1 rounded font-medium"
                              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', color: 'var(--text-med)' }}
                            >
                              Lacre
                            </button>
                          )}
                        </div>
                      )}
                      {c.status === 'EM_LANCAMENTO' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={concluirCaminhao.isPending}
                            onClick={() => {
                              void concluirCaminhao.mutateAsync(c.id).then(() => void refetch());
                            }}
                            className="text-xs px-2 py-1 rounded font-medium disabled:opacity-50"
                            style={{ background: 'var(--ok-dim)', color: 'var(--ok-text)' }}
                          >
                            Concluir
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejeitarModal({ caminhaoId: c.id, sequencia: c.sequencia })}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: 'var(--nc-dim)', color: 'var(--nc-text)' }}
                          >
                            Rejeitar
                          </button>
                          {c.lacre_aprovado === null && (
                            <button
                              type="button"
                              onClick={() => {
                                void setLacre.mutateAsync({ caminhaoId: c.id, aprovado: true });
                              }}
                              className="text-xs px-2 py-1 rounded font-medium"
                              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', color: 'var(--text-med)' }}
                            >
                              Lacre
                            </button>
                          )}
                        </div>
                      )}
                      {(c.status === 'CONCLUIDO' || c.status === 'REJEITADO') && (
                        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Corpos de Prova */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
          <FlaskConical size={16} />
          Corpos de Prova ({data.corpos_de_prova.length})
          {concrtagemAtiva && data.caminhoes.length > 0 && (
            <button
              type="button"
              onClick={() => setCpModal(true)}
              className="ml-auto text-xs px-3 py-1 rounded-lg font-medium"
              style={{ background: 'var(--accent)', color: 'var(--text-high)' }}
            >
              + Moldar CP
            </button>
          )}
        </h2>
        {data.corpos_de_prova.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">Nenhum CP moldado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-dim)]">
                  {['Número', 'Idade', 'Moldagem', 'Ruptura Prev.', 'Resistência', 'Status', 'Ações'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[var(--text-faint)] font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.corpos_de_prova.map((cp) => {
                  const vencido =
                    cp.status === 'AGUARDANDO_RUPTURA' &&
                    new Date(cp.data_ruptura_prev) < new Date();
                  return (
                    <tr key={cp.id} className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--text-high)]">{cp.numero}</td>
                      <td className="px-3 py-2 text-[var(--text-med)]">{cp.idade_dias}d</td>
                      <td className="px-3 py-2 text-[var(--text-med)]">{formatData(cp.data_moldagem)}</td>
                      <td className="px-3 py-2">
                        <span className={cn('text-[var(--text-med)]', vencido && 'text-[var(--nc-text)] font-medium')}>
                          {formatData(cp.data_ruptura_prev)}
                          {vencido && (
                            <span className="ml-1 text-xs">
                              <Clock size={11} className="inline -mt-0.5" /> vencido
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-med)]">
                        {cp.resistencia != null ? `${Number(cp.resistencia).toFixed(1)} MPa` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', CP_COLORS[cp.status])}>
                          {CP_LABELS[cp.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {cp.status === 'AGUARDANDO_RUPTURA' ? (
                          <button
                            type="button"
                            onClick={() => setRupturaModal({ cpId: cp.id, numero: cp.numero, idadeDias: cp.idade_dias })}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: 'var(--ok-dim)', color: 'var(--ok-text)' }}
                          >
                            Registrar Ruptura
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Observações */}
      {data.observacoes && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg p-4">
          <p className="text-xs font-medium text-[var(--text-faint)] mb-1">Observações</p>
          <p className="text-sm text-[var(--text-med)]">{data.observacoes}</p>
        </div>
      )}

      {/* Laudos de Laboratório */}
      <LaudosSection concrtagemId={concrtagemIdNum} />

      {/* RACs */}
      <RacsSection obraId={obraIdNum} />

      {/* ── Modais ──────────────────────────────────────────────────────────── */}

      {caminhaoModal && (
        <CaminhaoModal
          concrtagemId={concrtagemIdNum}
          obraId={obraIdNum}
          onClose={() => { setCaminhaoModal(false); void refetch(); }}
          elementosDisponiveis={elementosDisponiveis}
        />
      )}

      {slumpModal && (
        <SlumpModal
          caminhaoId={slumpModal.caminhaoId}
          obraId={obraIdNum}
          concrtagemId={concrtagemIdNum}
          onClose={() => { setSlumpModal(null); void refetch(); }}
        />
      )}

      {rejeitarModal && (
        <RejeitarCaminhaoModal
          caminhaoId={rejeitarModal.caminhaoId}
          sequencia={rejeitarModal.sequencia}
          obraId={obraIdNum}
          concrtagemId={concrtagemIdNum}
          onClose={() => { setRejeitarModal(null); void refetch(); }}
        />
      )}

      {cpModal && (
        <MoldagemCpModal
          concrtagemId={concrtagemIdNum}
          obraId={obraIdNum}
          caminhoes={caminhoesMoldagem.length > 0 ? caminhoesMoldagem : data.caminhoes.map((c) => ({ id: c.id, sequencia: c.sequencia, numero_nf: c.numero_nf }))}
          onClose={() => { setCpModal(false); void refetch(); }}
        />
      )}

      {rupturaModal && (
        <RupturaModal
          cpId={rupturaModal.cpId}
          numero={rupturaModal.numero}
          idadeDias={rupturaModal.idadeDias}
          obraId={obraIdNum}
          concrtagemId={concrtagemIdNum}
          onClose={() => { setRupturaModal(null); void refetch(); }}
        />
      )}
    </div>
  );
}
