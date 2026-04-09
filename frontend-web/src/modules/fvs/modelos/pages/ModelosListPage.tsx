// frontend-web/src/modules/fvs/modelos/pages/ModelosListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useModelos, useDeleteModelo, useConcluirModelo,
  useReabrirModelo, useDuplicarModelo,
} from '../hooks/useModelos';
import type { FvsModelo } from '../../../../services/fvs.service';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho:  { label: 'Rascunho',  color: '#6b7280' },
  concluido: { label: 'Concluído', color: '#22c55e' },
};

const REGIME_LABEL: Record<string, string> = {
  livre:  'Inspeção Interna',
  pbqph:  'PBQP-H',
};

export function ModelosListPage() {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<string | undefined>(undefined);
  const { data: modelos = [], isLoading } = useModelos({ status: filtroStatus });
  const deletar = useDeleteModelo();
  const concluir = useConcluirModelo();
  const reabrir = useReabrirModelo();
  const duplicar = useDuplicarModelo();
  const [erro, setErro] = useState('');

  async function handleAcao(acao: 'concluir' | 'reabrir' | 'duplicar' | 'excluir', modelo: FvsModelo) {
    setErro('');
    try {
      if (acao === 'excluir') {
        if (!confirm(`Excluir template "${modelo.nome}"?`)) return;
        await deletar.mutateAsync(modelo.id);
      } else if (acao === 'concluir') {
        await concluir.mutateAsync(modelo.id);
      } else if (acao === 'reabrir') {
        await reabrir.mutateAsync(modelo.id);
      } else if (acao === 'duplicar') {
        const novo = await duplicar.mutateAsync(modelo.id);
        navigate(`/fvs/modelos/${novo.id}`);
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? `Erro ao ${acao} template`);
    }
  }

  if (isLoading) return <div style={{ padding: 24 }}>Carregando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Templates de Inspeção</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={filtroStatus ?? ''}
            onChange={(e) => setFiltroStatus(e.target.value || undefined)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          >
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="concluido">Concluído</option>
          </select>
          <button
            onClick={() => navigate('/fvs/modelos/novo')}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}
          >
            + Novo Template
          </button>
        </div>
      </div>

      {erro && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>{erro}</p>}

      {modelos.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhum template encontrado. Crie o primeiro!</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Nome</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Regime</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Escopo</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Bloqueado</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Versão</th>
              <th style={{ padding: '8px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {modelos.map((m) => {
              const st = STATUS_LABEL[m.status] ?? { label: m.status, color: '#6b7280' };
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                    <span
                      onClick={() => navigate(`/fvs/modelos/${m.id}`)}
                      style={{ cursor: 'pointer', color: '#3b82f6' }}
                    >
                      {m.nome}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{REGIME_LABEL[m.regime] ?? m.regime}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{m.escopo}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: st.color + '22', color: st.color,
                      borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                    }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: m.bloqueado ? '#dc2626' : '#22c55e' }}>
                    {m.bloqueado ? 'Sim' : 'Não'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>v{m.versao}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {m.status === 'rascunho' && !m.bloqueado && (
                        <button onClick={() => handleAcao('concluir', m)} style={btnStyle('#22c55e')}>Concluir</button>
                      )}
                      {m.status === 'concluido' && !m.bloqueado && (
                        <button onClick={() => handleAcao('reabrir', m)} style={btnStyle('#f59e0b')}>Reabrir</button>
                      )}
                      <button onClick={() => handleAcao('duplicar', m)} style={btnStyle('#6b7280')}>Duplicar</button>
                      {!m.bloqueado && (
                        <button onClick={() => handleAcao('excluir', m)} style={btnStyle('#dc2626')}>Excluir</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: 'transparent', color, border: `1px solid ${color}`,
    borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12,
  };
}
