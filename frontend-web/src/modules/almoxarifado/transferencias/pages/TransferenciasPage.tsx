// frontend-web/src/modules/almoxarifado/transferencias/pages/TransferenciasPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransferencias, useCriarTransferencia } from '../hooks/useTransferencias';
import { useLocais } from '../../locais/hooks/useLocais';
import type { AlmTransferenciaStatus, CreateTransferenciaPayload } from '../../_service/almoxarifado.service';

const STATUS_BADGE: Record<AlmTransferenciaStatus, { label: string; color: string; bg: string }> = {
  rascunho:             { label: 'Rascunho',           color: 'var(--text-low)', bg: 'rgba(128,128,128,0.15)' },
  aguardando_aprovacao: { label: 'Aguard. Aprovação',  color: '#b45309',         bg: 'rgba(245,158,11,0.15)' },
  aprovada:             { label: 'Aprovada',            color: 'var(--run)',      bg: 'rgba(var(--run-rgb), 0.15)' },
  executada:            { label: 'Executada',           color: 'var(--ok)',       bg: 'rgba(var(--ok-rgb), 0.15)' },
  cancelada:            { label: 'Cancelada',           color: 'var(--text-low)', bg: 'rgba(128,128,128,0.1)' },
};

function FormModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const criar = useCriarTransferencia();
  const { data: locais = [] } = useLocais({ ativo: true });
  const [form, setForm] = useState<Partial<CreateTransferenciaPayload>>({ itens: [] });
  const [novoItem, setNovoItem] = useState({ catalogo_id: '', quantidade: '', unidade: 'UN' });

  if (!isOpen) return null;

  const addItem = () => {
    if (!novoItem.catalogo_id || !novoItem.quantidade) return;
    setForm((f) => ({
      ...f,
      itens: [...(f.itens ?? []), {
        catalogo_id: Number(novoItem.catalogo_id),
        quantidade:  Number(novoItem.quantidade),
        unidade: novoItem.unidade,
      }],
    }));
    setNovoItem({ catalogo_id: '', quantidade: '', unidade: 'UN' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.local_origem_id || !form.local_destino_id || !form.itens?.length) return;
    await criar.mutateAsync(form as CreateTransferenciaPayload);
    onClose();
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 4,
    border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ color: 'var(--text-high)', marginBottom: 16 }}>Nova Transferência</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4, fontSize: 13 }}>Origem *</label>
              <select value={form.local_origem_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, local_origem_id: Number(e.target.value) || undefined }))} style={selectStyle}>
                <option value="">Selecionar...</option>
                {locais.filter((l) => l.id !== form.local_destino_id).map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4, fontSize: 13 }}>Destino *</label>
              <select value={form.local_destino_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, local_destino_id: Number(e.target.value) || undefined }))} style={selectStyle}>
                <option value="">Selecionar...</option>
                {locais.filter((l) => l.id !== form.local_origem_id).map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4, fontSize: 13 }}>Observação</label>
            <textarea
              value={form.observacao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              rows={2}
              style={{ ...selectStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>Itens *</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              {(form.itens ?? []).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-high)' }}>
                  <span style={{ flex: 2 }}>Catálogo #{item.catalogo_id}</span>
                  <span style={{ flex: 1 }}>{item.quantidade} {item.unidade}</span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, itens: f.itens?.filter((_, i) => i !== idx) }))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--warn)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, padding: '6px 10px' }}>
                <input placeholder="Catálogo ID" type="number" value={novoItem.catalogo_id}
                  onChange={(e) => setNovoItem((n) => ({ ...n, catalogo_id: e.target.value }))}
                  style={{ flex: 2, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)', fontSize: 13 }} />
                <input placeholder="Qtd" type="number" value={novoItem.quantidade}
                  onChange={(e) => setNovoItem((n) => ({ ...n, quantidade: e.target.value }))}
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)', fontSize: 13 }} />
                <input placeholder="UN" value={novoItem.unidade}
                  onChange={(e) => setNovoItem((n) => ({ ...n, unidade: e.target.value }))}
                  style={{ width: 50, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)', fontSize: 13 }} />
                <button type="button" onClick={addItem}
                  style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>+</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-high)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit"
              style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
              Criar Transferência
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TransferenciasPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AlmTransferenciaStatus | ''>('');
  const { data, isLoading } = useTransferencias({ status: statusFilter || undefined });

  const transferencias = data?.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ color: 'var(--text-high)', fontSize: 20, fontWeight: 600 }}>Transferências</h1>
        <button onClick={() => setModalOpen(true)}
          style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
          + Nova Transferência
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}>
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_BADGE) as AlmTransferenciaStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_BADGE[s].label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-low)' }}>Carregando...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Origem → Destino', 'Status', 'Valor Total', 'Data'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-low)', fontWeight: 500, fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transferencias.map((t) => {
              const badge = STATUS_BADGE[t.status];
              return (
                <tr key={t.id}
                  onClick={() => navigate(`/almoxarifado/transferencias/${t.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 13 }}>#{t.id}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-high)' }}>
                    {t.local_origem_nome} → {t.local_destino_nome}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-high)', fontSize: 13 }}>
                    {t.valor_total != null
                      ? `R$ ${Number(t.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 12 }}>
                    {new Date(t.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              );
            })}
            {!transferencias.length && (
              <tr>
                <td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-low)' }}>
                  Nenhuma transferência encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <FormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
