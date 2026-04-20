import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { obrasService } from '../../services/obras.service';
import { gedService, type GedListaMestraItem } from '../../services/ged.service';
import { api } from '../../services/api';

export function GedListaMestraPage() {
  const { id } = useParams<{ id: string }>();
  const obraId = parseInt(id!);
  const [exportando, setExportando] = useState<null | 'pdf' | 'xlsx'>(null);

  const { data: obra, isLoading: obraLoading } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => obrasService.getById(obraId),
  });

  const { data: listaMestra, isLoading, isError } = useQuery({
    queryKey: ['ged-lista-mestra', obraId],
    queryFn: () => gedService.getListaMestra(obraId),
    enabled: !!obra,
  });

  async function handleExport(tipo: 'pdf' | 'xlsx') {
    try {
      setExportando(tipo);
      const resp = await api.get(
        `/obras/${obraId}/ged/lista-mestra/export/${tipo}`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(resp.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lista-mestra-obra-${obraId}.${tipo}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Falha ao exportar lista mestra:', err);
      alert('Falha ao exportar lista mestra. Tente novamente.');
    } finally {
      setExportando(null);
    }
  }

  if (obraLoading || isLoading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>
        Carregando lista mestra...
      </div>
    );
  }

  if (isError || !listaMestra) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--nc)' }}>
        <AlertTriangle size={32} style={{ marginBottom: '12px' }} />
        <p>Erro ao carregar a Lista Mestra.</p>
      </div>
    );
  }

  const categorias = listaMestra.categorias ?? [];

  const totalDocs = categorias.reduce(
    (acc, cat) => acc + cat.documentos.length,
    0,
  );
  const totalAlerta = categorias.reduce(
    (acc, cat) => acc + cat.documentos.filter((d) => d.alertaVencimento).length,
    0,
  );

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
          {obra?.nome}
        </Link>
        <ChevronRight size={14} />
        <Link to={`/obras/${obraId}/ged`} style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>
          GED
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--text-high)', fontWeight: 600 }}>Lista Mestra</span>
      </div>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-high)' }}>
              Lista Mestra
            </h1>
            {listaMestra.modoAuditoria && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  padding: '4px 10px',
                  background: 'var(--warn-bg)',
                  color: 'var(--warn)',
                  border: '1px solid var(--warn)',
                  borderRadius: '99px',
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={13} />
                Modo Auditoria
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-mid)', fontSize: '13px' }}>
            {listaMestra.obra?.nome ?? obra?.nome} · Gerado em{' '}
            {listaMestra.geradoEm ? new Date(listaMestra.geradoEm).toLocaleString('pt-BR') : '—'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exportando !== null}
            title="Baixar lista mestra em PDF"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '9px 16px',
              cursor: exportando ? 'wait' : 'pointer',
              color: 'var(--text-high)',
              fontSize: '14px',
              opacity: exportando === 'pdf' ? 0.6 : 1,
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!exportando) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              if (!exportando) e.currentTarget.style.background = 'var(--bg-raised)';
            }}
          >
            <FileText size={15} />
            {exportando === 'pdf' ? 'Gerando...' : 'Exportar PDF'}
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exportando !== null}
            title="Baixar lista mestra em XLSX"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '9px 16px',
              cursor: exportando ? 'wait' : 'pointer',
              color: 'var(--text-high)',
              fontSize: '14px',
              opacity: exportando === 'xlsx' ? 0.6 : 1,
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!exportando) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              if (!exportando) e.currentTarget.style.background = 'var(--bg-raised)';
            }}
          >
            <FileSpreadsheet size={15} />
            {exportando === 'xlsx' ? 'Gerando...' : 'Exportar XLSX'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <StatPill label="Documentos vigentes" value={totalDocs} color="var(--ok)" />
        <StatPill label="Categorias" value={categorias.length} color="var(--accent)" />
        {totalAlerta > 0 && (
          <StatPill
            label="Alerta de vencimento"
            value={totalAlerta}
            color="var(--warn)"
            icon={<AlertTriangle size={14} />}
          />
        )}
      </div>

      {/* Categorias (acordeons) */}
      {categorias.length === 0 ? (
        <div
          style={{
            padding: '56px',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: 'var(--text-faint)',
          }}
        >
          <FileText size={40} style={{ marginBottom: '12px' }} />
          <p>Nenhum documento vigente encontrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {categorias.map((categoria) => (
            <CategoriaSection key={categoria.codigo} categoria={categoria} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '99px',
      }}
    >
      {icon}
      <span style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>{label}</span>
    </div>
  );
}

function CategoriaSection({
  categoria,
}: {
  categoria: {
    codigo: string;
    nome: string;
    documentos: GedListaMestraItem[];
  };
}) {
  const [aberto, setAberto] = useState(true);
  const temAlertas = categoria.documentos.some((d) => d.alertaVencimento);

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header do acordeon */}
      <button
        onClick={() => setAberto((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderBottom: aberto ? '1px solid var(--border)' : 'none',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: 'var(--text-faint)',
              background: 'var(--bg-raised)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            {categoria.codigo}
          </span>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-high)' }}>
            {categoria.nome}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-faint)',
              background: 'var(--bg-raised)',
              padding: '2px 6px',
              borderRadius: '99px',
            }}
          >
            {categoria.documentos.length} doc
            {categoria.documentos.length !== 1 ? 's' : ''}
          </span>
          {temAlertas && (
            <AlertTriangle size={15} color="var(--warn)" />
          )}
        </div>
        {aberto ? (
          <ChevronUp size={18} color="var(--text-faint)" />
        ) : (
          <ChevronDown size={18} color="var(--text-faint)" />
        )}
      </button>

      {/* Tabela */}
      {aberto && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
              {['Código', 'Título', 'Revisão', 'Aprovado em', 'Aprovado por', 'Validade'].map(
                (col) => (
                  <th
                    key={col}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-faint)',
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
            {categoria.documentos.map((doc, i) => (
              <ListaMestraRow
                key={doc.codigo}
                doc={doc}
                isLast={i === categoria.documentos.length - 1}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ListaMestraRow({
  doc,
  isLast,
}: {
  doc: GedListaMestraItem;
  isLast: boolean;
}) {
  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border-dim)',
        background: doc.alertaVencimento ? 'var(--warn-bg)' : 'transparent',
      }}
    >
      <td style={{ padding: '11px 16px' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: doc.alertaVencimento ? 'var(--warn)' : 'var(--text-faint)',
            background: 'var(--bg-raised)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {doc.codigo}
        </span>
      </td>
      <td style={{ padding: '11px 16px' }}>
        <span
          style={{
            fontSize: '14px',
            color: doc.alertaVencimento ? 'var(--warn)' : 'var(--text-high)',
            fontWeight: doc.alertaVencimento ? 500 : 400,
          }}
        >
          {doc.titulo}
        </span>
      </td>
      <td style={{ padding: '11px 16px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-mid)' }}>
          Rev. {doc.numeroRevisao}
        </span>
      </td>
      <td style={{ padding: '11px 16px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>
          {new Date(doc.aprovadoEm).toLocaleDateString('pt-BR')}
        </span>
      </td>
      <td style={{ padding: '11px 16px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>{doc.aprovadoPor}</span>
      </td>
      <td style={{ padding: '11px 16px' }}>
        {doc.dataValidade ? (
          <span
            style={{
              fontSize: '13px',
              color: doc.alertaVencimento ? 'var(--warn)' : 'var(--text-mid)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: doc.alertaVencimento ? 600 : 400,
            }}
          >
            {doc.alertaVencimento && <AlertTriangle size={13} />}
            {new Date(doc.dataValidade).toLocaleDateString('pt-BR')}
          </span>
        ) : (
          <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>—</span>
        )}
      </td>
    </tr>
  );
}
