import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Upload,
  FileText,
  ChevronRight,
  Search,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { obrasService } from '../../services/obras.service';
import {
  gedService,
  type GedStatus,
  type GedDisciplina,
  type GedDocumento,
} from '../../services/ged.service';
import { useAuthStore } from '../../store/auth.store';
import { GedUploadModal } from './components/GedUploadModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<GedStatus, string> = {
  RASCUNHO: 'Rascunho',
  IFA: 'Em Revisão',
  IFC: 'Vigente (IFC)',
  IFP: 'Vigente (IFP)',
  AS_BUILT: 'As Built',
  REJEITADO: 'Rejeitado',
  OBSOLETO: 'Obsoleto',
  CANCELADO: 'Cancelado',
};

const DISCIPLINA_LABELS: Record<GedDisciplina, string> = {
  ARQ: 'Arquitetura',
  EST: 'Estrutural',
  HID: 'Hidráulica',
  ELE: 'Elétrica',
  MEC: 'Mecânica',
  GEO: 'Geotecnia',
};

function statusBadge(status: GedStatus): React.CSSProperties {
  switch (status) {
    case 'IFC':
    case 'IFP':
    case 'AS_BUILT':
      return { color: 'var(--ok)', background: 'var(--ok-bg)', borderColor: 'var(--ok-border)' };
    case 'IFA':
      return { color: 'var(--warn)', background: 'var(--warn-bg)', borderColor: 'var(--warn)' };
    case 'REJEITADO':
      return { color: 'var(--nc)', background: 'var(--nc-bg)', borderColor: 'var(--nc)' };
    case 'OBSOLETO':
    case 'CANCELADO':
      return { color: 'var(--text-faint)', background: 'var(--bg-raised)', borderColor: 'var(--border-dim)' };
    default:
      return { color: 'var(--off)', background: 'var(--off-bg)', borderColor: 'var(--off)' };
  }
}

const ROLE_ORDEM = { VISITANTE: 0, TECNICO: 1, ENGENHEIRO: 2, ADMIN_TENANT: 3 };

function temPermissao(role: string | undefined, minRole: keyof typeof ROLE_ORDEM): boolean {
  if (!role) return false;
  return (ROLE_ORDEM[role as keyof typeof ROLE_ORDEM] ?? -1) >= ROLE_ORDEM[minRole];
}

const STATUS_TABS: Array<{ value: GedStatus | 'TODOS'; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'IFA', label: 'Em Revisão' },
  { value: 'IFC', label: 'IFC' },
  { value: 'IFP', label: 'IFP' },
  { value: 'AS_BUILT', label: 'As Built' },
  { value: 'REJEITADO', label: 'Rejeitado' },
];

// ─── Página ───────────────────────────────────────────────────────────────────

export function GedDocumentosPage() {
  const { id } = useParams<{ id: string }>();
  const obraId = parseInt(id!);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [statusFiltro, setStatusFiltro] = useState<GedStatus | 'TODOS'>('TODOS');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [disciplinaFiltro, setDisciplinaFiltro] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: obra, isLoading: obraLoading } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => obrasService.getById(obraId),
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['ged-categorias', obraId],
    queryFn: () => gedService.getCategorias(obraId),
  });

  const { data: pastas = [] } = useQuery({
    queryKey: ['ged-pastas', obraId],
    queryFn: () => gedService.getPastas(obraId),
  });

  const params = {
    ...(statusFiltro !== 'TODOS' && { status: statusFiltro }),
    ...(categoriaFiltro && { categoriaId: Number(categoriaFiltro) }),
    ...(disciplinaFiltro && { disciplina: disciplinaFiltro }),
    ...(busca && { q: busca }),
    page,
    limit: 20,
  };

  const { data: resultado, isLoading, isError } = useQuery({
    queryKey: ['ged-documentos', obraId, params],
    queryFn: () => gedService.listar(obraId, params),
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

  const documentos = resultado?.items ?? [];
  const total = resultado?.total ?? 0;
  const totalPages = resultado?.totalPages ?? 1;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
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
        <Link to={`/obras/${obraId}`} style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>
          {obra.nome}
        </Link>
        <ChevronRight size={14} />
        <Link to={`/obras/${obraId}/ged`} style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>
          GED
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--text-high)', fontWeight: 600 }}>Documentos</span>
      </div>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-high)' }}>
            Documentos
          </h1>
          <p style={{ color: 'var(--text-mid)', fontSize: '13px', marginTop: '2px' }}>
            {obra.nome} · {total} documento{total !== 1 ? 's' : ''}
          </p>
        </div>

        {temPermissao(user?.role, 'TECNICO') && (
          <button
            onClick={() => setUploadOpen(true)}
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
            Upload
          </button>
        )}
      </div>

      {/* Filtros — barra superior */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {/* Busca */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            flex: '1',
            minWidth: '180px',
          }}
        >
          <Search size={15} color="var(--text-faint)" />
          <input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(1); }}
            placeholder="Buscar por título ou código..."
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: 'var(--text-high)',
              width: '100%',
            }}
          />
        </div>

        {/* Categoria */}
        <select
          value={categoriaFiltro}
          onChange={(e) => { setCategoriaFiltro(e.target.value); setPage(1); }}
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--text-high)',
            fontSize: '14px',
            outline: 'none',
          }}
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        {/* Disciplina */}
        <select
          value={disciplinaFiltro}
          onChange={(e) => { setDisciplinaFiltro(e.target.value); setPage(1); }}
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--text-high)',
            fontSize: '14px',
            outline: 'none',
          }}
        >
          <option value="">Todas as disciplinas</option>
          {(Object.entries(DISCIPLINA_LABELS) as [GedDisciplina, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Tabs de status */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatusFiltro(t.value); setPage(1); }}
            style={{
              padding: '6px 14px',
              borderRadius: '99px',
              border: '1px solid',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: statusFiltro === t.value ? 600 : 400,
              background: statusFiltro === t.value ? 'var(--accent)' : 'var(--bg-surface)',
              borderColor: statusFiltro === t.value ? 'var(--accent)' : 'var(--border)',
              color: statusFiltro === t.value ? '#000' : 'var(--text-mid)',
              transition: 'all var(--transition-fast)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>
            Carregando documentos...
          </div>
        ) : isError ? (
          <ErrorState />
        ) : documentos.length === 0 ? (
          <EmptyState onUpload={() => setUploadOpen(true)} podeUpload={temPermissao(user?.role, 'TECNICO')} />
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Código', 'Título', 'Disciplina', 'Status', 'Revisão', 'Aprovado em', 'Validade', ''].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-mid)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          background: 'var(--bg-raised)',
                        }}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {documentos.map((doc, i) => (
                  <DocumentoRow
                    key={doc.id}
                    doc={doc}
                    isLast={i === documentos.length - 1}
                    onClick={() =>
                      navigate(`/obras/${obraId}/ged/documentos/${doc.id}`)
                    }
                  />
                ))}
              </tbody>
            </table>

            {/* Paginação */}
            {totalPages > 1 && (
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    color: 'var(--text-mid)',
                    opacity: page === 1 ? 0.5 : 1,
                    fontSize: '13px',
                  }}
                >
                  Anterior
                </button>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '13px',
                    color: 'var(--text-mid)',
                    padding: '0 8px',
                  }}
                >
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    color: 'var(--text-mid)',
                    opacity: page === totalPages ? 0.5 : 1,
                    fontSize: '13px',
                  }}
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de upload */}
      {uploadOpen && (
        <GedUploadModal
          obraId={obraId}
          pastas={pastas}
          categorias={categorias}
          onClose={() => setUploadOpen(false)}
          onSuccess={() => {
            setUploadOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ged-documentos', obraId] });
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function DocumentoRow({
  doc,
  isLast,
  onClick,
}: {
  doc: GedDocumento;
  isLast: boolean;
  onClick: () => void;
}) {
  const badgeStyle = statusBadge(doc.versaoAtual.status);
  const validade = doc.versaoAtual.dataValidade;
  const vencida = validade ? new Date(validade) < new Date() : false;

  return (
    <tr
      onClick={onClick}
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border-dim)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '12px 16px' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: 'var(--text-faint)',
            background: 'var(--bg-raised)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {doc.codigo}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={15} color="var(--text-faint)" />
          <span style={{ fontSize: '14px', color: 'var(--text-high)' }}>{doc.titulo}</span>
          {doc.escopo === 'EMPRESA' && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                borderRadius: '4px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Building2 size={10} /> EMPRESA
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>
          {doc.disciplina ? DISCIPLINA_LABELS[doc.disciplina] : '—'}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span
          style={{
            ...badgeStyle,
            fontSize: '12px',
            padding: '3px 8px',
            borderRadius: '99px',
            border: '1px solid',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {STATUS_LABELS[doc.versaoAtual.status]}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '13px',
            color: 'var(--text-mid)',
          }}
        >
          Rev. {doc.versaoAtual.numeroRevisao}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>
          {doc.versaoAtual.aprovadoEm
            ? new Date(doc.versaoAtual.aprovadoEm).toLocaleDateString('pt-BR')
            : '—'}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        {validade ? (
          <span
            style={{
              fontSize: '13px',
              color: vencida ? 'var(--nc)' : 'var(--text-mid)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {vencida && <AlertTriangle size={13} />}
            {new Date(validade).toLocaleDateString('pt-BR')}
          </span>
        ) : (
          <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <ChevronRight size={16} color="var(--text-faint)" />
      </td>
    </tr>
  );
}

function ErrorState() {
  return (
    <div
      style={{
        padding: '48px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <AlertTriangle size={32} color="var(--nc)" />
      <p style={{ color: 'var(--nc)', fontWeight: 600 }}>Erro ao carregar documentos</p>
      <p style={{ color: 'var(--text-mid)', fontSize: '14px' }}>
        Verifique sua conexão e tente novamente.
      </p>
    </div>
  );
}

function EmptyState({
  onUpload,
  podeUpload,
}: {
  onUpload: () => void;
  podeUpload: boolean;
}) {
  return (
    <div
      style={{
        padding: '56px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <FileText size={40} color="var(--text-faint)" />
      <p style={{ color: 'var(--text-mid)', fontWeight: 600, fontSize: '16px' }}>
        Nenhum documento encontrado
      </p>
      {podeUpload && (
        <button
          onClick={onUpload}
          style={{
            marginTop: '4px',
            background: 'transparent',
            border: '1px dashed var(--border)',
            color: 'var(--text-mid)',
            borderRadius: '8px',
            padding: '8px 20px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Upload size={15} /> Fazer upload do primeiro documento
        </button>
      )}
    </div>
  );
}
