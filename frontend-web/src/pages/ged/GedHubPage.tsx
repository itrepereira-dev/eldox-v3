import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FileText, List, Send, FolderOpen, Upload, ChevronRight } from 'lucide-react';
import { obrasService } from '../../services/obras.service';
import { gedService, type GedPasta } from '../../services/ged.service';
import { useAuthStore } from '../../store/auth.store';

const ROLE_ORDEM = { VISITANTE: 0, TECNICO: 1, ENGENHEIRO: 2, ADMIN_TENANT: 3 };

function temPermissao(
  role: string | undefined,
  minRole: keyof typeof ROLE_ORDEM,
): boolean {
  if (!role) return false;
  return (ROLE_ORDEM[role as keyof typeof ROLE_ORDEM] ?? -1) >= ROLE_ORDEM[minRole];
}

export function GedHubPage() {
  const { id } = useParams<{ id: string }>();
  const obraId = parseInt(id!);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: obra, isLoading: obraLoading } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => obrasService.getById(obraId),
  });

  const { data: pastas = [], isLoading: pastasLoading } = useQuery({
    queryKey: ['ged-pastas', obraId],
    queryFn: () => gedService.getPastas(obraId),
    enabled: !!obra,
  });

  const { data: stats } = useQuery({
    queryKey: ['ged-stats', obraId],
    queryFn: () => gedService.getStats(obraId),
    enabled: !!obra,
  });

  if (obraLoading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>
        Carregando...
      </div>
    );
  }

  if (!obra) return null;

  const cardBase: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--text-mid)',
          marginBottom: '20px',
        }}
      >
        <Link to="/obras" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>
          Obras
        </Link>
        <ChevronRight size={14} />
        <Link
          to={`/obras/${obraId}`}
          style={{ color: 'var(--text-mid)', textDecoration: 'none' }}
        >
          {obra.nome}
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--text-high)', fontWeight: 600 }}>GED</span>
      </div>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-high)' }}>
            GED — {obra.nome}
          </h1>
          <p style={{ color: 'var(--text-mid)', fontSize: '14px', marginTop: '4px' }}>
            Gestão Eletrônica de Documentos
          </p>
        </div>

        {temPermissao(user?.role, 'TECNICO') && (
          <button
            onClick={() => navigate(`/obras/${obraId}/ged/documentos`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--accent)',
              border: 'none',
              color: '#000',
              borderRadius: '8px',
              padding: '10px 18px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <Upload size={16} />
            Novo Documento
          </button>
        )}
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <StatCard label="Total de documentos" value={stats?.total ?? '—'} color="var(--text-high)" />
        <StatCard label="Documentos vigentes" value={stats?.vigentes ?? '—'} color="var(--ok)" />
        <StatCard
          label="Vencendo em 30 dias"
          value={stats?.vencendo30dias ?? '—'}
          color={stats?.vencendo30dias ? 'var(--warn)' : 'var(--text-high)'}
        />
      </div>

      {/* Ações rápidas */}
      <h2
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--text-mid)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '12px',
        }}
      >
        Módulos
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div
          style={cardBase}
          onClick={() => navigate(`/obras/${obraId}/ged/documentos`)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = 'var(--bg-hover)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = 'var(--bg-surface)')
          }
        >
          <FileText size={24} color="var(--accent)" />
          <span style={{ fontWeight: 600, color: 'var(--text-high)', fontSize: '15px' }}>
            Documentos
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>
            Consultar, filtrar e fazer upload
          </span>
        </div>

        <div
          style={cardBase}
          onClick={() => navigate(`/obras/${obraId}/ged/lista-mestra`)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = 'var(--bg-hover)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = 'var(--bg-surface)')
          }
        >
          <List size={24} color="var(--ok)" />
          <span style={{ fontWeight: 600, color: 'var(--text-high)', fontSize: '15px' }}>
            Lista Mestra
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>
            Documentos vigentes por categoria
          </span>
        </div>

        <div
          style={{
            ...cardBase,
            cursor: 'not-allowed',
            opacity: 0.55,
          }}
        >
          <Send size={24} color="var(--text-faint)" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-high)', fontSize: '15px' }}>
              Transmittals
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                background: 'var(--bg-raised)',
                color: 'var(--text-faint)',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              EM BREVE
            </span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>
            Envio e rastreio de documentos
          </span>
        </div>
      </div>

      {/* Pastas */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FolderOpen size={18} color="var(--accent)" />
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-high)' }}>
            Pastas
          </h2>
        </div>

        {pastasLoading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-mid)' }}>
            Carregando pastas...
          </div>
        ) : pastas.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)' }}>
            Nenhuma pasta criada ainda.
          </div>
        ) : (
          <PastaTree pastas={pastas} obraId={obraId} navigate={navigate} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '16px 20px',
      }}
    >
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-mid)', marginTop: '4px' }}>
        {label}
      </div>
    </div>
  );
}

function PastaTree({
  pastas,
  obraId,
  navigate,
  parentId = undefined,
  depth = 0,
}: {
  pastas: GedPasta[];
  obraId: number;
  navigate: ReturnType<typeof useNavigate>;
  parentId?: number;
  depth?: number;
}) {
  const filhos = pastas.filter((p) => p.parentId === parentId);

  if (filhos.length === 0) return null;

  return (
    <div>
      {filhos.map((pasta, i) => (
        <div key={pasta.id}>
          <div
            style={{
              padding: '12px 20px',
              paddingLeft: `${20 + depth * 20}px`,
              borderBottom:
                i === filhos.length - 1 && depth === 0 ? 'none' : '1px solid var(--border-dim)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
            onClick={() =>
              navigate(`/obras/${obraId}/ged/documentos?pastaId=${pasta.id}`)
            }
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--bg-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            <FolderOpen size={16} color="var(--accent)" />
            <span style={{ fontSize: '14px', color: 'var(--text-high)', flex: 1 }}>
              {pasta.nome}
            </span>
            <ChevronRight size={14} color="var(--text-faint)" />
          </div>
          <PastaTree
            pastas={pastas}
            obraId={obraId}
            navigate={navigate}
            parentId={pasta.id}
            depth={depth + 1}
          />
        </div>
      ))}
    </div>
  );
}
