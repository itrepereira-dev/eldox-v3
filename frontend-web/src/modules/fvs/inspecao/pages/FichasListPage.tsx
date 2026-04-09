// frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFichas, useDeleteFicha } from '../hooks/useFichas';
import type { FichaFvs } from '../../../../services/fvs.service';

const REGIME_LABEL: Record<string, string> = {
  pbqph: 'PBQP-H',
  norma_tecnica: 'Norma Técnica',
  livre: 'Livre',
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho:          { label: 'Rascunho',        color: '#6b7280' },
  em_inspecao:       { label: 'Em Inspeção',      color: '#3b82f6' },
  concluida:         { label: 'Concluída',         color: '#22c55e' },
  aguardando_parecer: { label: 'Aguard. Parecer', color: '#f97316' },
  aprovada:          { label: 'Aprovada',          color: '#15803d' },
};

export function FichasListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useFichas(undefined, page);
  const deleteFicha = useDeleteFicha();

  const fichas: FichaFvs[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  if (isLoading) return <div style={{ padding: 24 }}>Carregando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Fichas FVS</h1>
        <button
          onClick={() => navigate('/fvs/fichas/nova')}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
          }}
        >
          + Nova Ficha
        </button>
      </div>

      {fichas.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhuma ficha encontrada. Crie a primeira!</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Nome</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Regime</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Progresso</th>
              <th style={{ padding: '8px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {fichas.map((f) => {
              const statusInfo = STATUS_LABEL[f.status] ?? { label: f.status, color: '#6b7280' };
              return (
                <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{f.nome}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: '#f3f4f6', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                      {REGIME_LABEL[f.regime] ?? f.regime}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: statusInfo.color, fontSize: 12, fontWeight: 600 }}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', minWidth: 120 }}>
                    <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6, width: '100%' }}>
                      <div style={{
                        background: '#22c55e', height: '100%', borderRadius: 99,
                        width: `${f.progresso ?? 0}%`, transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{f.progresso ?? 0}%</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/fvs/fichas/${f.id}`)}
                      style={{
                        background: 'transparent', border: '1px solid #d1d5db',
                        borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 13, marginRight: 8,
                      }}
                    >
                      Abrir
                    </button>
                    {f.status === 'rascunho' && (
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${f.nome}"?`)) deleteFicha.mutate(f.id);
                        }}
                        style={{
                          background: 'transparent', border: '1px solid #fca5a5',
                          borderRadius: 5, padding: '4px 12px', cursor: 'pointer',
                          fontSize: 13, color: '#ef4444',
                        }}
                      >
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '4px 12px', cursor: 'pointer' }}>
            ← Anterior
          </button>
          <span style={{ padding: '4px 8px', fontSize: 13 }}>Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '4px 12px', cursor: 'pointer' }}>
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
