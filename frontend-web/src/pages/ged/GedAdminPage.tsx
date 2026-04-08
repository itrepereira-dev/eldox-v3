import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Building2,
  Search,
  Upload,
  ChevronRight,
  AlertTriangle,
  Share2,
} from 'lucide-react';
import {
  gedService,
  type GedStatus,
  type GedDisciplina,
  type GedDocumento,
} from '../../services/ged.service';
import { obrasService, type Obra } from '../../services/obras.service';
import { useAuthStore } from '../../store/auth.store';

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

function getStatusStyle(status: GedStatus): React.CSSProperties {
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

export function GedAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [statusFiltro, setStatusFiltro] = useState<GedStatus | 'TODOS'>('TODOS');
  const [disciplinaFiltro, setDisciplinaFiltro] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [abaAtiva, setAbaAtiva] = useState<'documentos' | 'compartilhamento'>('documentos');

  const params = {
    ...(statusFiltro !== 'TODOS' && { status: statusFiltro }),
    ...(disciplinaFiltro && { disciplina: disciplinaFiltro }),
    ...(busca && { q: busca }),
    page,
    limit: 20,
  };

  const { data: resultado, isLoading, isError } = useQuery({
    queryKey: ['ged-empresa-documentos', params],
    queryFn: () => gedService.listarEmpresa(params),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => obrasService.getAll(),
  });

  const documentos = resultado?.items ?? [];
  const total = resultado?.total ?? 0;
  const totalPages = resultado?.totalPages ?? 1;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-high)' }}>
              GED — Documentos da Empresa
            </h1>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                padding: '3px 10px',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                borderRadius: '99px',
                fontWeight: 600,
              }}
            >
              <Building2 size={12} />
              EMPRESA
            </span>
          </div>
          <p style={{ color: 'var(--text-mid)', fontSize: '13px' }}>
            Documentos de escopo corporativo · {total} documento{total !== 1 ? 's' : ''}
          </p>
        </div>

        {user?.role === 'ADMIN_TENANT' && (
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
            Novo Documento
          </button>
        )}
      </div>

      {/* Abas */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {(
          [
            { key: 'documentos', label: 'Documentos', icon: <FileText size={15} /> },
            { key: 'compartilhamento', label: 'Compartilhamento', icon: <Share2 size={15} /> },
          ] as const
        ).map((aba) => (
          <button
            key={aba.key}
            onClick={() => setAbaAtiva(aba.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${abaAtiva === aba.key ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer',
              color: abaAtiva === aba.key ? 'var(--accent)' : 'var(--text-mid)',
              fontSize: '14px',
              fontWeight: abaAtiva === aba.key ? 600 : 400,
              marginBottom: '-1px',
              transition: 'all var(--transition-fast)',
            }}
          >
            {aba.icon}
            {aba.label}
          </button>
        ))}
      </div>

      {/* Aba: Documentos */}
      {abaAtiva === 'documentos' && (
        <>
          {/* Filtros */}
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

          {/* Tabs status */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
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
                Carregando...
              </div>
            ) : isError ? (
              <div
                style={{
                  padding: '48px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--nc)',
                }}
              >
                <AlertTriangle size={32} />
                <p>Erro ao carregar documentos.</p>
              </div>
            ) : documentos.length === 0 ? (
              <div
                style={{
                  padding: '56px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-faint)',
                }}
              >
                <FileText size={40} />
                <p>Nenhum documento encontrado.</p>
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Código', 'Título', 'Disciplina', 'Status', 'Revisão', 'Aprovado em', ''].map(
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
                      <EmpresaDocRow
                        key={doc.id}
                        doc={doc}
                        isLast={i === documentos.length - 1}
                        onClick={() => navigate(`/ged/admin/documentos/${doc.id}`)}
                      />
                    ))}
                  </tbody>
                </table>

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
        </>
      )}

      {/* Aba: Compartilhamento */}
      {abaAtiva === 'compartilhamento' && (
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
            <Share2 size={17} color="var(--accent)" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-high)' }}>
              Obras com acesso a documentos da empresa
            </h2>
          </div>

          {obras.length === 0 ? (
            <div
              style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '14px' }}
            >
              Nenhuma obra cadastrada.
            </div>
          ) : (
            <div>
              {(obras as Obra[]).map((obra, i) => (
                <div
                  key={obra.id}
                  style={{
                    padding: '14px 20px',
                    borderBottom:
                      i === obras.length - 1 ? 'none' : '1px solid var(--border-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Building2 size={16} color="var(--text-faint)" />
                    <span style={{ fontSize: '14px', color: 'var(--text-high)' }}>
                      {obra.nome}
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: 'var(--text-faint)',
                        background: 'var(--bg-raised)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {obra.codigo}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 10px',
                      background: 'var(--ok-bg)',
                      color: 'var(--ok)',
                      border: '1px solid var(--ok-border)',
                      borderRadius: '99px',
                    }}
                  >
                    Acesso ativo
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function EmpresaDocRow({
  doc,
  isLast,
  onClick,
}: {
  doc: GedDocumento;
  isLast: boolean;
  onClick: () => void;
}) {
  const badgeStyle = getStatusStyle(doc.versaoAtual.status);

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
        <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-mid)' }}>
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
        <ChevronRight size={16} color="var(--text-faint)" />
      </td>
    </tr>
  );
}
