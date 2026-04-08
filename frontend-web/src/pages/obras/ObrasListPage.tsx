import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { obrasService, type Obra } from '../../services/obras.service';

const STATUS_LABEL: Record<string, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_EXECUCAO: 'Em Execução',
  PARALISADA: 'Paralisada',
  CONCLUIDA: 'Concluída',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<string, string> = {
  PLANEJAMENTO: 'var(--text-60)',
  EM_EXECUCAO: 'var(--status-success)',
  PARALISADA: 'var(--status-warning)',
  CONCLUIDA: 'var(--accent)',
  ENTREGUE: 'var(--status-info)',
};

export function ObrasListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState('');
  const [confirmRemover, setConfirmRemover] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['obras', statusFiltro],
    queryFn: () => obrasService.getAll({ status: statusFiltro || undefined }),
  });

  const removerMutation = useMutation({
    mutationFn: (id: number) => obrasService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      setConfirmRemover(null);
    },
  });

  const obras: Obra[] = data?.items ?? [];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-100)' }}>
            Obras
          </h1>
          <p style={{ color: 'var(--text-60)', marginTop: '4px', fontSize: '14px' }}>
            {data?.total ?? 0} obra{(data?.total ?? 0) !== 1 ? 's' : ''} cadastrada{(data?.total ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/obras/nova')}
          style={{
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Nova Obra
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['', 'PLANEJAMENTO', 'EM_EXECUCAO', 'PARALISADA', 'CONCLUIDA'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${statusFiltro === s ? 'var(--accent)' : 'var(--bg-border)'}`,
              background: statusFiltro === s ? 'var(--accent-dim)' : 'var(--bg-elevated)',
              color: statusFiltro === s ? 'var(--accent)' : 'var(--text-60)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {s === '' ? 'Todas' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-60)' }}>
          Carregando obras...
        </div>
      )}

      {/* Grid de obras */}
      {!isLoading && obras.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '64px',
            border: '1px dashed var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <p style={{ color: 'var(--text-60)', marginBottom: '16px' }}>
            Nenhuma obra cadastrada
          </p>
          <button
            onClick={() => navigate('/obras/nova')}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Cadastrar primeira obra
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {obras.map((obra) => (
          <ObraCard
            key={obra.id}
            obra={obra}
            onVer={() => navigate(`/obras/${obra.id}`)}
            onRemover={() => setConfirmRemover(obra.id)}
          />
        ))}
      </div>

      {/* Modal de confirmação */}
      {confirmRemover !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
            }}
          >
            <h3 style={{ marginBottom: '12px' }}>Remover obra?</h3>
            <p style={{ color: 'var(--text-60)', marginBottom: '24px', fontSize: '14px' }}>
              A obra e todos os locais associados serão arquivados. Esta ação pode ser desfeita pelo administrador.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmRemover(null)}
                style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                  color: 'var(--text-80)', borderRadius: 'var(--radius-md)',
                  padding: '8px 16px', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => removerMutation.mutate(confirmRemover)}
                disabled={removerMutation.isPending}
                style={{
                  background: 'var(--status-error)', border: 'none',
                  color: '#fff', borderRadius: 'var(--radius-md)',
                  padding: '8px 16px', cursor: 'pointer',
                }}
              >
                {removerMutation.isPending ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ObraCard({
  obra,
  onVer,
  onRemover,
}: {
  obra: Obra;
  onVer: () => void;
  onRemover: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--bg-border)')}
      onClick={onVer}
    >
      {/* Topo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-40)' }}>
              {obra.codigo}
            </span>
            {obra.modoQualidade === 'PBQPH' && (
              <span
                style={{
                  fontSize: '10px', padding: '2px 6px',
                  background: 'var(--accent-dim)', color: 'var(--accent)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                PBQP-H
              </span>
            )}
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-100)', marginBottom: '4px' }}>
            {obra.nome}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-60)' }}>
            {obra.obraTipo.nome}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemover(); }}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-40)',
            cursor: 'pointer', fontSize: '18px', padding: '0 0 0 8px',
          }}
          title="Remover"
        >
          ×
        </button>
      </div>

      {/* Localização */}
      {(obra.cidade || obra.estado) && (
        <p style={{ fontSize: '13px', color: 'var(--text-60)', marginTop: '12px' }}>
          📍 {[obra.cidade, obra.estado].filter(Boolean).join(', ')}
        </p>
      )}

      {/* Rodapé */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: STATUS_COLOR[obra.status] ?? 'var(--text-60)',
          }}
        >
          ● {STATUS_LABEL[obra.status] ?? obra.status}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-60)' }}>
          {obra.totalLocais} local{obra.totalLocais !== 1 ? 'is' : ''}
        </span>
      </div>
    </div>
  );
}
