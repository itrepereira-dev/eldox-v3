// frontend-web/src/modules/almoxarifado/transferencias/pages/TransferenciaDetalhePage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTransferencia, useAprovarTransferencia, useExecutarTransferencia, useCancelarTransferencia } from '../hooks/useTransferencias';
import type { AlmTransferenciaStatus } from '../../_service/almoxarifado.service';

const STATUS_BADGE: Record<AlmTransferenciaStatus, { label: string; color: string; bg: string }> = {
  rascunho:             { label: 'Rascunho',           color: 'var(--text-low)', bg: 'rgba(128,128,128,0.15)' },
  aguardando_aprovacao: { label: 'Aguard. Aprovação',  color: '#b45309',         bg: 'rgba(245,158,11,0.15)' },
  aprovada:             { label: 'Aprovada',            color: 'var(--run)',      bg: 'rgba(var(--run-rgb), 0.15)' },
  executada:            { label: 'Executada',           color: 'var(--ok)',       bg: 'rgba(var(--ok-rgb), 0.15)' },
  cancelada:            { label: 'Cancelada',           color: 'var(--text-low)', bg: 'rgba(128,128,128,0.1)' },
};

export function TransferenciaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: transferencia, isLoading } = useTransferencia(id ? Number(id) : undefined);
  const aprovar = useAprovarTransferencia();
  const executar = useExecutarTransferencia();
  const cancelar = useCancelarTransferencia();

  if (isLoading) return <div style={{ padding: 24, color: 'var(--text-low)' }}>Carregando...</div>;
  if (!transferencia) return <div style={{ padding: 24, color: 'var(--text-low)' }}>Transferência não encontrada</div>;

  const badge = STATUS_BADGE[transferencia.status];

  const handleAprovar = async () => {
    try {
      await aprovar.mutateAsync(transferencia.id);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao aprovar');
    }
  };

  const handleExecutar = async () => {
    if (!window.confirm('Executar a transferência completa?')) return;
    try {
      await executar.mutateAsync({ id: transferencia.id });
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao executar');
    }
  };

  const handleCancelar = async () => {
    const motivo = window.prompt('Motivo do cancelamento (opcional):');
    if (motivo === null) return;
    try {
      await cancelar.mutateAsync({ id: transferencia.id, motivo: motivo || undefined });
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao cancelar');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <button onClick={() => navigate(-1)}
        style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
        ← Voltar
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: 'var(--text-high)', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
            Transferência #{transferencia.id}
          </h1>
          <p style={{ color: 'var(--text-low)', fontSize: 14 }}>
            {transferencia.local_origem_nome} → {transferencia.local_destino_nome}
          </p>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600, color: badge.color, background: badge.bg }}>
          {badge.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Valor Total', value: transferencia.valor_total != null ? `R$ ${Number(transferencia.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—' },
          { label: 'Criado em', value: new Date(transferencia.created_at).toLocaleDateString('pt-BR') },
          { label: 'Exec. Parcial', value: transferencia.executada_parcial ? 'Sim' : 'Não' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
            <p style={{ color: 'var(--text-low)', fontSize: 12, marginBottom: 4 }}>{label}</p>
            <p style={{ color: 'var(--text-high)', fontSize: 15, fontWeight: 600 }}>{value}</p>
          </div>
        ))}
      </div>

      <h2 style={{ color: 'var(--text-high)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Itens</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Catálogo', 'Qtd Solicitada', 'Qtd Executada', 'Progresso'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-low)', fontWeight: 500, fontSize: 13 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(transferencia.itens ?? []).map((item) => {
            const pct = item.quantidade > 0 ? Math.round((item.qtd_executada / item.quantidade) * 100) : 0;
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-high)', fontSize: 13 }}>
                  {item.catalogo_nome ?? `#${item.catalogo_id}`}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-high)', fontSize: 13 }}>
                  {item.quantidade} {item.unidade}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-high)', fontSize: 13 }}>
                  {item.qtd_executada} {item.unidade}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--ok)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-low)', minWidth: 36 }}>{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {transferencia.observacao && (
        <div style={{ marginBottom: 24, padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <p style={{ color: 'var(--text-low)', fontSize: 12, marginBottom: 4 }}>Observação</p>
          <p style={{ color: 'var(--text-high)', fontSize: 14 }}>{transferencia.observacao}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {transferencia.status === 'aguardando_aprovacao' && (
          <button onClick={handleAprovar}
            style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'var(--ok)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Aprovar
          </button>
        )}
        {transferencia.status === 'aprovada' && (
          <button onClick={handleExecutar}
            style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'var(--run)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Executar
          </button>
        )}
        {['rascunho', 'aguardando_aprovacao', 'aprovada'].includes(transferencia.status) && (
          <button onClick={handleCancelar}
            style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid var(--warn)', background: 'transparent', color: 'var(--warn)', cursor: 'pointer', fontWeight: 500 }}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
