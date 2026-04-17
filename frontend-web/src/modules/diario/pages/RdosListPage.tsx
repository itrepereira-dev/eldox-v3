import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rdoService } from '../../../services/rdo.service';
import type { Rdo, RdoStatus } from '../../../services/rdo.service';

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_META: Record<RdoStatus, { label: string; color: string; bg: string; border: string }> = {
  preenchendo: { label: 'Preenchendo', color: 'var(--warn)',  bg: 'rgba(210,153,34,.12)',  border: 'rgba(210,153,34,.3)'  },
  revisao:     { label: 'Revisão',     color: 'var(--run)',   bg: 'rgba(88,166,255,.12)',  border: 'rgba(88,166,255,.3)'  },
  aprovado:    { label: 'Aprovado',    color: 'var(--ok)',    bg: 'rgba(63,185,80,.12)',   border: 'rgba(63,185,80,.3)'   },
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── StatusBadge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RdoStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '2px 10px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.4px',
      textTransform: 'uppercase',
      color: meta.color,
      background: meta.bg,
      border: `1px solid ${meta.border}`,
    }}>
      {meta.label}
    </span>
  );
}

// ─── SkeletonRows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)' }}>
          {[90, 110, 100, 140, 80].map((w, j) => (
            <td key={j} style={{ padding: '14px 16px' }}>
              <div style={{
                height: 13,
                width: w,
                borderRadius: 6,
                background: 'var(--bg-raised)',
                animation: 'eldox-pulse 1.4s ease-in-out infinite',
              }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── ConfirmModal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  rdoNumero: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmModal({ rdoNumero, onConfirm, onCancel, loading }: ConfirmModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '28px 32px',
        width: 380,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(248,81,73,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--nc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-high)', fontSize: 15 }}>
              Excluir RDO #{rdoNumero}?
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-low)' }}>
              Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '7px 18px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-high)', fontSize: 13, cursor: 'pointer',
              opacity: loading ? .5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '7px 18px', borderRadius: 'var(--r-sm)',
              border: '1px solid transparent', background: 'var(--nc)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1,
            }}
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NovoRdoModal ────────────────────────────────────────────────────────────

const COPY_FIELDS = [
  { key: 'clima',        label: 'Clima',        defaultOn: true  },
  { key: 'equipe',       label: 'Equipe',       defaultOn: true  },
  { key: 'atividades',   label: 'Atividades',   defaultOn: true  },
  { key: 'equipamentos', label: 'Equipamentos', defaultOn: false },
  { key: 'checklist',    label: 'Checklist',    defaultOn: false },
] as const;

type CopyKey = typeof COPY_FIELDS[number]['key'];

interface NovoRdoModalProps {
  obraId: number;
  onClose: () => void;
  onCreated: (rdoId: number) => void;
}

function NovoRdoModal({ obraId, onClose, onCreated }: NovoRdoModalProps) {
  const [data, setData] = useState(todayISO());
  const [copiarInteligente, setCopiarInteligente] = useState(false);
  const [camposSelecionados, setCamposSelecionados] = useState<Record<CopyKey, boolean>>(
    Object.fromEntries(COPY_FIELDS.map(f => [f.key, f.defaultOn])) as Record<CopyKey, boolean>
  );
  const [errorMsg, setErrorMsg] = useState('');

  const { mutate: criar, isPending } = useMutation({
    mutationFn: () => rdoService.criar({
      obra_id: obraId,
      data,
      copiar_ultimo: copiarInteligente,
      copiar_campos: copiarInteligente
        ? (Object.entries(camposSelecionados).filter(([, v]) => v).map(([k]) => k))
        : undefined,
    }),
    onSuccess: (res) => onCreated(res.rdo_id),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrorMsg(msg ?? 'Erro ao criar RDO. Tente novamente.');
    },
  });

  function toggleCampo(key: CopyKey) {
    setCamposSelecionados(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-high)' }}>
            Novo Diário de Obra
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-low)', cursor: 'pointer', padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Data
          </label>
          <input
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-raised)',
              color: 'var(--text-high)',
              fontSize: 14,
              fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
          />
        </div>

        {/* Toggle Copiar Inteligente */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => setCopiarInteligente(v => !v)}>
          <div style={{
            width: 40, height: 22, borderRadius: 99,
            background: copiarInteligente ? 'var(--accent)' : 'var(--border)',
            position: 'relative', transition: 'background .2s',
            flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 3, left: copiarInteligente ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left .2s',
            }} />
          </div>
          <span style={{ fontSize: 14, color: 'var(--text-high)', fontWeight: 500, userSelect: 'none' }}>
            Copiar Inteligente
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-low)', marginLeft: 'auto', userSelect: 'none' }}>
            do último RDO
          </span>
        </div>

        {/* Campos a copiar */}
        {copiarInteligente && (
          <div style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-dim)',
            borderRadius: 'var(--r-md)',
            padding: '14px 16px',
            display: 'flex', flexWrap: 'wrap', gap: 10,
          }}>
            {COPY_FIELDS.map(f => (
              <label
                key={f.key}
                style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}
              >
                <input
                  type="checkbox"
                  checked={camposSelecionados[f.key]}
                  onChange={() => toggleCampo(f.key)}
                  style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-high)' }}>{f.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--nc)', background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.25)', padding: '8px 12px', borderRadius: 'var(--r-sm)' }}>
            {errorMsg}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: '8px 18px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-high)', fontSize: 13, cursor: 'pointer',
              opacity: isPending ? .5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { setErrorMsg(''); criar(); }}
            disabled={isPending || !data}
            style={{
              padding: '8px 22px', borderRadius: 'var(--r-sm)',
              border: '1px solid transparent', background: 'var(--accent)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: isPending || !data ? 'not-allowed' : 'pointer',
              opacity: isPending || !data ? .7 : 1,
            }}
          >
            {isPending ? 'Criando...' : 'Criar RDO'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RdosListPage ─────────────────────────────────────────────────────────────

export function RdosListPage() {
  const { id } = useParams<{ id: string }>();
  const obraId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState<RdoStatus | ''>('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [showNovoModal, setShowNovoModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Rdo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtros = { statusFiltro, dataInicio, dataFim, page };

  const { data, isLoading } = useQuery({
    queryKey: ['rdos', obraId, filtros],
    queryFn: () => rdoService.listar({
      obra_id: obraId,
      status: statusFiltro || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      page,
      limit: 20,
    }),
    enabled: !!obraId,
  });

  const { mutate: excluir, isPending: excluindo } = useMutation({
    mutationFn: (rdoId: number) => rdoService.excluir(rdoId),
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['rdos', obraId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao excluir RDO';
      setDeleteTarget(null);
      setDeleteError(msg);
    },
  });

  const rdos: Rdo[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const statusCounts = data?.status_counts ?? {} as Record<RdoStatus, number>;
  const totalPages = Math.ceil(total / 20) || 1;

  function handleCreated(rdoId: number) {
    setShowNovoModal(false);
    queryClient.invalidateQueries({ queryKey: ['rdos', obraId] });
    navigate(`/obras/${obraId}/diario/${rdoId}`);
  }

  return (
    <div style={{ padding: 28, fontFamily: 'var(--font-ui)', color: 'var(--text-high)' }}>
      {/* pulse keyframe injected once */}
      <style>{`@keyframes eldox-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-high)' }}>
          Diário de Obra
        </h1>
        <button
          onClick={() => setShowNovoModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 20px', borderRadius: 'var(--r-md)',
            background: 'var(--accent)', border: '1px solid transparent',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo RDO
        </button>
      </div>

      {/* ── Status chips ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {(Object.keys(STATUS_META) as RdoStatus[]).map(s => {
          const meta = STATUS_META[s];
          const count = statusCounts[s] ?? 0;
          return (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 99,
              background: meta.bg, border: `1px solid ${meta.border}`,
            }}>
              <span style={{ fontSize: 12, color: meta.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                {meta.label}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#fff',
                background: meta.color, borderRadius: 99,
                padding: '1px 7px', minWidth: 22, textAlign: 'center',
              }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Filtros ── */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end',
        padding: '14px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r-md)',
      }}>
        {/* Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Status
          </label>
          <select
            value={statusFiltro}
            onChange={e => { setStatusFiltro(e.target.value as RdoStatus | ''); setPage(1); }}
            style={{
              padding: '7px 28px 7px 10px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-raised)',
              color: 'var(--text-high)',
              fontSize: 13, fontFamily: 'var(--font-ui)',
              cursor: 'pointer', outline: 'none', appearance: 'none',
              minWidth: 140,
            }}
          >
            <option value="">Todos</option>
            <option value="preenchendo">Preenchendo</option>
            <option value="revisao">Revisão</option>
            <option value="aprovado">Aprovado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        {/* Data início */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            De
          </label>
          <input
            type="date"
            value={dataInicio}
            onChange={e => { setDataInicio(e.target.value); setPage(1); }}
            style={{
              padding: '7px 10px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-raised)',
              color: 'var(--text-high)', fontSize: 13, fontFamily: 'var(--font-ui)', outline: 'none',
            }}
          />
        </div>

        {/* Data fim */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Até
          </label>
          <input
            type="date"
            value={dataFim}
            onChange={e => { setDataFim(e.target.value); setPage(1); }}
            style={{
              padding: '7px 10px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-raised)',
              color: 'var(--text-high)', fontSize: 13, fontFamily: 'var(--font-ui)', outline: 'none',
            }}
          />
        </div>

        {(statusFiltro || dataInicio || dataFim) && (
          <button
            onClick={() => { setStatusFiltro(''); setDataInicio(''); setDataFim(''); setPage(1); }}
            style={{
              padding: '7px 14px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border-dim)', background: 'transparent',
              color: 'var(--text-low)', fontSize: 12, cursor: 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Delete error ── */}
      {deleteError && (
        <p style={{
          margin: '0 0 16px', fontSize: 13, color: 'var(--nc)',
          background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.25)',
          padding: '8px 12px', borderRadius: 'var(--r-sm)',
        }}>
          {deleteError}
        </p>
      )}

      {/* ── Tabela ── */}
      <div style={{
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-dim)' }}>
              {['Nº', 'Data', 'Status', 'Obra', 'Ações'].map((col, i) => (
                <th key={col} style={{
                  padding: '10px 16px', textAlign: i === 4 ? 'right' : 'left',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-faint)',
                  textTransform: 'uppercase', letterSpacing: '.5px',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows />
            ) : rdos.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div style={{ padding: '56px 16px', textAlign: 'center' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                    <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: 14 }}>
                      Nenhum RDO encontrado.
                    </p>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-faint)', fontSize: 12 }}>
                      Clique em "+ Novo RDO" para começar.
                    </p>
                  </div>
                </td>
              </tr>
            ) : rdos.map((rdo, i) => (
              <tr
                key={rdo.id}
                style={{
                  borderBottom: i < rdos.length - 1 ? '1px solid var(--border-dim)' : undefined,
                  background: i % 2 === 0 ? 'var(--bg-void)' : 'var(--bg-surface)',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-void)' : 'var(--bg-surface)')}
              >
                <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-low)', fontSize: 12 }}>
                  #{String(rdo.numero).padStart(4, '0')}
                </td>
                <td style={{ padding: '13px 16px', color: 'var(--text-high)' }}>
                  {fmtDate(rdo.data)}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <StatusBadge status={rdo.status} />
                </td>
                <td style={{ padding: '13px 16px', color: 'var(--text-low)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rdo.obra_nome ?? `Obra #${rdo.obra_id}`}
                </td>
                <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => navigate(`/obras/${obraId}/diario/${rdo.id}`)}
                      style={{
                        padding: '5px 14px', borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--accent)', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Ver
                    </button>
                    <button
                      onClick={() => setDeleteTarget(rdo)}
                      style={{
                        padding: '5px 14px', borderRadius: 'var(--r-sm)',
                        border: '1px solid rgba(248,81,73,.35)',
                        background: 'rgba(248,81,73,.08)',
                        color: 'var(--nc)', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '7px 16px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-high)', fontSize: 13, cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? .4 : 1,
            }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-low)' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '7px 16px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-high)', fontSize: 13, cursor: page === totalPages ? 'not-allowed' : 'pointer',
              opacity: page === totalPages ? .4 : 1,
            }}
          >
            Próximo →
          </button>
        </div>
      )}

      {/* ── Modais ── */}
      {showNovoModal && (
        <NovoRdoModal
          obraId={obraId}
          onClose={() => setShowNovoModal(false)}
          onCreated={handleCreated}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          rdoNumero={deleteTarget.numero}
          loading={excluindo}
          onConfirm={() => excluir(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
