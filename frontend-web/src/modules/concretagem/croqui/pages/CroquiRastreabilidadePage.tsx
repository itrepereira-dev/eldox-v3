// frontend-web/src/modules/concretagem/croqui/pages/CroquiRastreabilidadePage.tsx
// Página de Croquis de Rastreabilidade — SPEC 7

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Grid3x3, Clock, ChevronRight, Trash2, Eye, Cpu } from 'lucide-react';
import { useListarCroquis, useDeletarCroqui } from '../hooks/useCroqui';
import { CroquiEditorModal } from '../components/CroquiEditorModal';
import type { CroquiResumo } from '@/services/concretagem.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ConfiancaTag({ v }: { v: number | null }) {
  if (v == null) return null;
  const pct = Math.round(v * 100);
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 11,
        fontWeight: 600,
        color,
        padding: '1px 7px',
        borderRadius: 9999,
        border: `1.5px solid ${color}`,
      }}
    >
      <Cpu size={10} />
      IA {pct}%
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            borderRadius: 12,
            padding: 20,
            border: '1px solid var(--border-dim, #e2e8f0)',
            background: 'var(--bg-surface, #fff)',
          }}
        >
          <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 160, height: 14, borderRadius: 6, background: 'var(--bg-raised, #f1f5f9)' }} />
            <div style={{ width: 80, height: 11, borderRadius: 6, background: 'var(--bg-raised, #f1f5f9)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card de Croqui ───────────────────────────────────────────────────────────

function CroquiCard({
  croqui,
  obraId,
  onDelete,
}: {
  croqui: CroquiResumo;
  obraId: number;
  onDelete: (id: number) => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        borderRadius: 12,
        padding: '16px 18px',
        border: '1px solid var(--border-dim, #e2e8f0)',
        background: 'var(--bg-surface, #fff)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'box-shadow 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
      onClick={() => navigate(`/obras/${obraId}/concretagem/croqui/${croqui.id}`)}
    >
      {/* Ícone + Nome */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: '#ede9fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Grid3x3 size={18} color="#7c3aed" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-high, #0f172a)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {croqui.nome}
          </p>
          {croqui.obra_local_id && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
              Local #{croqui.obra_local_id}
            </p>
          )}
        </div>
      </div>

      {/* Confiança IA + Data */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ConfiancaTag v={croqui.ia_confianca} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
          <Clock size={11} />
          {fmtData(croqui.created_at)}
        </div>
      </div>

      {/* Ações */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
          paddingTop: 10,
          borderTop: '1px solid var(--border-dim, #f1f5f9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => navigate(`/obras/${obraId}/concretagem/croqui/${croqui.id}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 600,
            color: '#6366f1',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          <Eye size={13} />
          Ver croqui
          <ChevronRight size={12} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(croqui.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            color: '#dc2626',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 6,
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function CroquiRastreabilidadePage() {
  const { obraId } = useParams<{ obraId: string }>();
  const navigate = useNavigate();
  const id = Number(obraId);

  const { data: croquis, isLoading } = useListarCroquis(id);
  const deletarMutation = useDeletarCroqui(id);

  const [modalAberto, setModalAberto] = useState(false);
  const [deletandoId, setDeletandoId] = useState<number | null>(null);

  async function handleDelete(croquiId: number) {
    if (!window.confirm('Excluir este croqui? Esta ação não pode ser desfeita.')) return;
    setDeletandoId(croquiId);
    try {
      await deletarMutation.mutateAsync(croquiId);
    } finally {
      setDeletandoId(null);
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1080, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-high, #0f172a)' }}>
            Croquis de Rastreabilidade
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-faint, #94a3b8)' }}>
            Mapeamento visual dos elementos estruturais para controle de concretagem
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={16} />
          Novo Croqui
        </button>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <SkeletonCards />
      ) : !croquis || croquis.length === 0 ? (
        <EmptyState onNovo={() => setModalAberto(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {croquis.map((c) => (
            <CroquiCard
              key={c.id}
              croqui={c}
              obraId={id}
              onDelete={deletandoId ? () => {} : handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <CroquiEditorModal
          obraId={id}
          onClose={() => setModalAberto(false)}
          onSaved={(croquiId) => {
            setModalAberto(false);
            navigate(`/obras/${obraId}/concretagem/croqui/${croquiId}`);
          }}
        />
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNovo }: { onNovo: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: '#ede9fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Grid3x3 size={30} color="#7c3aed" />
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-high, #0f172a)' }}>
        Nenhum croqui cadastrado
      </h3>
      <p style={{ margin: '6px 0 20px', fontSize: 13, color: 'var(--text-faint, #94a3b8)', maxWidth: 360 }}>
        Envie a planta estrutural e a EldoX.IA monta o croqui automaticamente — depois você rastreia cada lançamento de concreto por elemento.
      </p>
      <button
        type="button"
        onClick={onNovo}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '11px 22px',
          borderRadius: 10,
          border: 'none',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        <Plus size={16} />
        Criar primeiro croqui
      </button>
    </div>
  );
}
