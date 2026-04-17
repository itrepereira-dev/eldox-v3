import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rdoService } from '../../../services/rdo.service';
import type { Rdo, RdoStatus } from '../../../services/rdo.service';
import { useAuthStore } from '../../../store/auth.store';

// ─── Types ───────────────────────────────────────────────────────────────────

type ValidacaoInconsistencia = {
  tipo: 'bloqueante' | 'atencao' | 'sugestao';
  campo: string;
  mensagem: string;
  sugestao_correcao: string;
};

type ValidacaoResult = {
  pode_enviar: boolean;
  inconsistencias: ValidacaoInconsistencia[];
};

// ─── constants ───────────────────────────────────────────────────────────────

const APPROVAL_ROLES = ['ADMIN_TENANT', 'ENGENHEIRO', 'APROVADOR'];

const STAGES: { status: RdoStatus; label: string; description: string }[] = [
  { status: 'preenchendo', label: 'Preenchendo', description: 'RDO em elaboração' },
  { status: 'revisao',     label: 'Revisão',     description: 'Aguardando revisão técnica' },
  { status: 'aprovado',    label: 'Aprovado',     description: 'RDO aprovado e finalizado' },
];

const STATUS_ORDER: Record<RdoStatus, number> = {
  preenchendo: 0,
  revisao: 1,
  aprovado: 2,
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── StageIcon ────────────────────────────────────────────────────────────────

type StageState = 'done' | 'active' | 'pending';

function StageIcon({ state }: { state: StageState }) {
  if (state === 'done') {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(63,185,80,.15)', border: '2px solid var(--ok)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
  }
  if (state === 'active') {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--accent-dim)', border: '2px solid var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
      </div>
    );
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'var(--bg-raised)', border: '2px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-faint)' }} />
    </div>
  );
}

// ─── AssinaturaModal ──────────────────────────────────────────────────────────

interface AssinaturaModalProps {
  rdoNumero: number;
  canApprove: boolean;
  onConfirm: (nota: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function AssinaturaModal({ rdoNumero, canApprove, onConfirm, onCancel, loading }: AssinaturaModalProps) {
  const [nota, setNota] = useState('');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '28px 32px',
        width: 420,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(63,185,80,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-high)', fontSize: 15 }}>
              Aprovar RDO #{rdoNumero}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-low)' }}>
              Confirme a aprovação do diário de obra
            </p>
          </div>
        </div>

        {/* Role warning */}
        {!canApprove && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '10px 14px',
            background: 'rgba(210,153,34,.08)',
            border: '1px solid rgba(210,153,34,.3)',
            borderRadius: 'var(--r-sm)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>
              Apenas engenheiros e aprovadores podem aprovar RDOs. Esta ação pode ser rejeitada pelo servidor.
            </p>
          </div>
        )}

        {/* Nota */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Observações de aprovação <span style={{ color: 'var(--text-faint)', textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
          </label>
          <textarea
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Confirmo a aprovação deste RDO..."
            rows={3}
            style={{
              padding: '9px 12px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-raised)',
              color: 'var(--text-high)', fontSize: 13,
              fontFamily: 'var(--font-ui)', resize: 'vertical', outline: 'none',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 18px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-high)', fontSize: 13, cursor: 'pointer',
              opacity: loading ? .5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(nota)}
            disabled={loading}
            style={{
              padding: '8px 22px', borderRadius: 'var(--r-sm)',
              border: '1px solid transparent',
              background: canApprove ? 'var(--ok)' : 'var(--warn)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .7 : 1,
            }}
          >
            {loading ? 'Aprovando...' : 'Confirmar Aprovação'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RdoWorkflowPage ──────────────────────────────────────────────────────────

export function RdoWorkflowPage() {
  const { id, rdoId } = useParams<{ id: string; rdoId: string }>();
  const obraId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userRole = useAuthStore(s => s.user?.role ?? '');
  const canApprove = APPROVAL_ROLES.includes(userRole);

  const [showAssinaturaModal, setShowAssinaturaModal] = useState(false);
  const [validacaoResult, setValidacaoResult] = useState<ValidacaoResult | null>(null);
  const [validando, setValidando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const { data: rdo, isLoading } = useQuery<Rdo>({
    queryKey: ['rdo', rdoId],
    queryFn: () => rdoService.buscar(Number(rdoId)),
    enabled: !!rdoId,
  });

  const { mutate: transicionar, isPending: transitioning } = useMutation({
    mutationFn: (novoStatus: 'revisao' | 'aprovado') =>
      rdoService.atualizarStatus(Number(rdoId), novoStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rdo', rdoId] });
      queryClient.invalidateQueries({ queryKey: ['rdos', obraId] });
      navigate(`/obras/${obraId}/diario/${rdoId}`);
    },
  });

  function handleEnviarRevisao() {
    transicionar('revisao');
  }

  async function handleAprovar(nota: string) {
    setSaving(true);
    setApproveError(null);
    try {
      await rdoService.atualizarStatus(Number(rdoId), 'aprovado', nota || undefined);
      await queryClient.invalidateQueries({ queryKey: ['rdo', rdoId] });
      await queryClient.invalidateQueries({ queryKey: ['rdos', obraId] });
      navigate(`/obras/${obraId}/diario/${rdoId}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao aprovar';
      setApproveError(msg);
    } finally {
      setSaving(false);
      setShowAssinaturaModal(false);
    }
  }

  async function handleValidar() {
    setValidando(true);
    try {
      const result = await rdoService.validar(Number(rdoId));
      setValidacaoResult(result);
    } finally {
      setValidando(false);
    }
  }

  // ── Loading ──
  if (isLoading || !rdo) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 240, color: 'var(--text-faint)', fontSize: 14,
        fontFamily: 'var(--font-ui)',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Carregando fluxo...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const currentOrder = STATUS_ORDER[rdo.status] ?? 0;

  // ── Render ──
  return (
    <div style={{ padding: 28, fontFamily: 'var(--font-ui)', color: 'var(--text-high)', maxWidth: 600 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <button
          onClick={() => navigate(`/obras/${obraId}/diario/${rdoId}`)}
          style={{
            background: 'none', border: '1px solid var(--border-dim)',
            borderRadius: 'var(--r-sm)', padding: '6px 10px',
            color: 'var(--text-low)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-high)' }}>
            Fluxo de Aprovação
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>
            RDO #{String(rdo.numero).padStart(4, '0')} — {new Date(rdo.data + 'T12:00:00').toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r-lg)',
        padding: '24px 28px',
        marginBottom: 28,
      }}>
        {STAGES.map((stage, idx) => {
          const stageOrder = STATUS_ORDER[stage.status];
          const state: StageState =
            stageOrder < currentOrder ? 'done' :
            stageOrder === currentOrder ? 'active' : 'pending';

          const isLast = idx === STAGES.length - 1;

          return (
            <div key={stage.status} style={{ display: 'flex', gap: 16 }}>
              {/* Icon + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <StageIcon state={state} />
                {!isLast && (
                  <div style={{
                    width: 2, flexGrow: 1, minHeight: 32,
                    background: state === 'done' ? 'var(--ok)' : 'var(--border-dim)',
                    margin: '4px 0',
                    transition: 'background .3s',
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ paddingBottom: isLast ? 0 : 28, paddingTop: 5, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{
                    fontSize: 15, fontWeight: 700,
                    color: state === 'active' ? 'var(--accent)' :
                           state === 'done'   ? 'var(--ok)' :
                                                'var(--text-faint)',
                  }}>
                    {stage.label}
                  </span>
                  {state === 'active' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.5px', color: 'var(--accent)',
                      background: 'var(--accent-dim)', padding: '2px 8px',
                      borderRadius: 99, border: '1px solid rgba(240,136,62,.3)',
                    }}>
                      Atual
                    </span>
                  )}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-faint)' }}>
                  {stage.description}
                </p>

                {/* Metadata for completed stages */}
                {state === 'done' && rdo.created_at && stage.status === 'preenchendo' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-low)' }}>
                    Criado em {fmtDateTime(rdo.created_at)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Painel de Validação IA ── */}
      {rdo.status !== 'aprovado' && validacaoResult && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          marginBottom: 20,
        }}>
          {/* Banner de aprovação */}
          {validacaoResult.pode_enviar && validacaoResult.inconsistencias.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 'var(--r-sm)',
              background: 'rgba(63,185,80,.1)', border: '1px solid rgba(63,185,80,.3)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ok)' }}>
                RDO aprovado para envio
              </span>
            </div>
          ) : (
            <>
              {/* Cabeçalho do painel */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-high)' }}>
                  Resultado da Validação IA
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px',
                  borderRadius: 20,
                  background: validacaoResult.pode_enviar ? 'rgba(63,185,80,.12)' : 'rgba(248,81,73,.12)',
                  color: validacaoResult.pode_enviar ? 'var(--ok)' : 'var(--nc)',
                }}>
                  {validacaoResult.pode_enviar ? 'PODE ENVIAR' : 'PENDÊNCIAS'}
                </span>
              </div>

              {/* Lista de inconsistências */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {validacaoResult.inconsistencias.map((item, idx) => {
                  const colorMap: Record<ValidacaoInconsistencia['tipo'], string> = {
                    bloqueante: 'var(--nc)',
                    atencao: 'var(--warn)',
                    sugestao: 'var(--run)',
                  };
                  const bgMap: Record<ValidacaoInconsistencia['tipo'], string> = {
                    bloqueante: 'rgba(248,81,73,.08)',
                    atencao: 'rgba(210,153,34,.08)',
                    sugestao: 'rgba(88,166,255,.08)',
                  };
                  const borderMap: Record<ValidacaoInconsistencia['tipo'], string> = {
                    bloqueante: 'rgba(248,81,73,.25)',
                    atencao: 'rgba(210,153,34,.25)',
                    sugestao: 'rgba(88,166,255,.25)',
                  };
                  const labelMap: Record<ValidacaoInconsistencia['tipo'], string> = {
                    bloqueante: 'BLOQUEANTE',
                    atencao: 'ATENÇÃO',
                    sugestao: 'SUGESTÃO',
                  };
                  const color = colorMap[item.tipo];
                  return (
                    <div key={idx} style={{
                      padding: '10px 12px', borderRadius: 'var(--r-sm)',
                      background: bgMap[item.tipo],
                      border: `1px solid ${borderMap[item.tipo]}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                          background: bgMap[item.tipo],
                          border: `1px solid ${borderMap[item.tipo]}`,
                          color,
                        }}>
                          {labelMap[item.tipo]}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-high)' }}>
                          {item.campo}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-high)', lineHeight: 1.5 }}>
                        {item.mensagem}
                      </p>
                      {item.sugestao_correcao && (
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-low)', lineHeight: 1.5 }}>
                          {item.sugestao_correcao}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Ação principal ── */}
      {rdo.status !== 'aprovado' && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--r-lg)',
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-high)' }}>
              {rdo.status === 'preenchendo'
                ? 'Enviar para revisão'
                : 'Aprovar RDO'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-low)' }}>
              {rdo.status === 'preenchendo'
                ? 'O RDO será enviado para avaliação técnica.'
                : 'O RDO será marcado como aprovado e finalizado.'}
            </p>
          </div>

          {/* Role warning for approving */}
          {rdo.status === 'revisao' && !canApprove && (
            <div style={{
              display: 'flex', gap: 9, alignItems: 'flex-start',
              padding: '9px 13px',
              background: 'rgba(210,153,34,.08)',
              border: '1px solid rgba(210,153,34,.25)',
              borderRadius: 'var(--r-sm)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>
                Apenas engenheiros e aprovadores podem aprovar RDOs.
              </p>
            </div>
          )}

          {/* Warning when validação bloqueante but user proceeds */}
          {validacaoResult && !validacaoResult.pode_enviar && (
            <div style={{
              display: 'flex', gap: 9, alignItems: 'flex-start',
              padding: '9px 13px',
              background: 'rgba(248,81,73,.08)',
              border: '1px solid rgba(248,81,73,.25)',
              borderRadius: 'var(--r-sm)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--nc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--nc)', lineHeight: 1.5 }}>
                A validação IA encontrou pendências bloqueantes. Você ainda pode avançar, mas o servidor pode rejeitar o envio.
              </p>
            </div>
          )}

          {/* Buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Validar com IA */}
            <button
              onClick={() => { void handleValidar(); }}
              disabled={validando}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-high)', fontSize: 13, fontWeight: 600,
                cursor: validando ? 'not-allowed' : 'pointer',
                opacity: validando ? .6 : 1,
                transition: 'opacity .15s',
              }}
            >
              {validando ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Validando...
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  Validar RDO com IA
                </>
              )}
            </button>

            {/* Advance status button */}
            <button
              onClick={() => {
                if (rdo.status === 'preenchendo') {
                  handleEnviarRevisao();
                } else {
                  setShowAssinaturaModal(true);
                }
              }}
              disabled={transitioning}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px', borderRadius: 'var(--r-md)',
                border: '1px solid transparent',
                background: rdo.status === 'preenchendo' ? 'var(--run)' : 'var(--ok)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: transitioning ? 'not-allowed' : 'pointer',
                opacity: transitioning ? .7 : 1,
                transition: 'opacity .15s',
              }}
            >
              {transitioning ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Processando...
                </>
              ) : rdo.status === 'preenchendo' ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Enviar para Revisão
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Aprovar RDO
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Aprovado state ── */}
      {rdo.status === 'aprovado' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 20px', borderRadius: 'var(--r-md)',
          background: 'rgba(63,185,80,.08)', border: '1px solid rgba(63,185,80,.25)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ok)', fontWeight: 600 }}>
            RDO aprovado e finalizado com sucesso.
          </p>
        </div>
      )}

      {/* spin keyframe */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Modal de assinatura ── */}
      {approveError && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--r-sm)', marginBottom: 16,
          background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.25)',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--nc)' }}>{approveError}</p>
        </div>
      )}

      {showAssinaturaModal && (
        <AssinaturaModal
          rdoNumero={rdo.numero}
          canApprove={canApprove}
          loading={saving}
          onConfirm={(nota) => { void handleAprovar(nota); }}
          onCancel={() => setShowAssinaturaModal(false)}
        />
      )}
    </div>
  );
}
