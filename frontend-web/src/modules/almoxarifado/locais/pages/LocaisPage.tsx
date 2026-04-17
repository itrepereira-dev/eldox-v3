// frontend-web/src/modules/almoxarifado/locais/pages/LocaisPage.tsx
import React, { useState } from 'react';
import { useLocais, useCriarLocal, useAtualizarLocal, useDesativarLocal } from '../hooks/useLocais';
import type { AlmLocal, AlmLocalTipo, CreateLocalPayload } from '../../_service/almoxarifado.service';

const TIPO_BADGE_COLOR: Record<AlmLocalTipo, string> = {
  CENTRAL:  'background: var(--accent); color: #fff',
  CD:       'background: var(--run); color: #fff',
  DEPOSITO: 'background: var(--warn); color: #000',
  OBRA:     'background: var(--ok); color: #fff',
};

const TIPO_LABEL: Record<AlmLocalTipo, string> = {
  CENTRAL:  'Central',
  CD:       'CD',
  DEPOSITO: 'Depósito',
  OBRA:     'Obra',
};

interface LocalModalProps {
  isOpen: boolean;
  onClose: () => void;
  local?: AlmLocal | null;
}

function LocalModal({ isOpen, onClose, local }: LocalModalProps) {
  const criar = useCriarLocal();
  const atualizar = useAtualizarLocal();

  const [form, setForm] = useState<Partial<CreateLocalPayload>>({
    tipo: local?.tipo ?? 'CENTRAL',
    nome: local?.nome ?? '',
    descricao: local?.descricao ?? '',
    obra_id: local?.obra_id ?? undefined,
    endereco: local?.endereco ?? '',
    responsavel_nome: local?.responsavel_nome ?? '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (local) {
      await atualizar.mutateAsync({ id: local.id, dto: form });
    } else {
      await criar.mutateAsync(form as CreateLocalPayload);
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 24, width: 480, maxWidth: '90vw',
      }}>
        <h2 style={{ color: 'var(--text-high)', marginBottom: 16 }}>
          {local ? 'Editar Local' : 'Novo Local'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Tipo *</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as AlmLocalTipo }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
            >
              <option value="CENTRAL">Central</option>
              <option value="CD">CD</option>
              <option value="DEPOSITO">Depósito</option>
              <option value="OBRA">Obra</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Nome *</label>
            <input
              required
              value={form.nome ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
            />
          </div>
          {form.tipo === 'OBRA' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Obra ID *</label>
              <input
                required
                type="number"
                value={form.obra_id ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, obra_id: Number(e.target.value) || undefined }))}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
              />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Endereço</label>
            <input
              value={form.endereco ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Responsável</label>
            <input
              value={form.responsavel_nome ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, responsavel_nome: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-high)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit"
              style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
              {local ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LocaisPage() {
  const { data: locais = [], isLoading } = useLocais({ ativo: undefined });
  const desativar = useDesativarLocal();
  const [modalOpen, setModalOpen] = useState(false);
  const [editLocal, setEditLocal] = useState<AlmLocal | null>(null);

  const handleEdit = (local: AlmLocal) => {
    setEditLocal(local);
    setModalOpen(true);
  };

  const handleNewLocal = () => {
    setEditLocal(null);
    setModalOpen(true);
  };

  const handleDesativar = async (local: AlmLocal) => {
    if (!window.confirm(`Desativar "${local.nome}"?`)) return;
    try {
      await desativar.mutateAsync(local.id);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao desativar local');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ color: 'var(--text-high)', fontSize: 20, fontWeight: 600 }}>Locais de Estoque</h1>
        <button
          onClick={handleNewLocal}
          style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
        >
          + Novo Local
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-low)' }}>Carregando...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Nome', 'Tipo', 'Obra', 'Responsável', 'Status', 'Ações'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-low)', fontWeight: 500, fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locais.map((local) => (
              <tr key={local.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-high)' }}>{local.nome}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, ...parseStyle(TIPO_BADGE_COLOR[local.tipo]) }}>
                    {TIPO_LABEL[local.tipo]}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 13 }}>
                  {local.obra_nome ?? (local.obra_id ? `#${local.obra_id}` : '—')}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 13 }}>{local.responsavel_nome ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                    background: local.ativo ? 'rgba(var(--ok-rgb), 0.15)' : 'rgba(var(--off-rgb), 0.15)',
                    color: local.ativo ? 'var(--ok)' : 'var(--text-low)' }}>
                    {local.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => handleEdit(local)}
                    style={{ marginRight: 8, padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-high)', cursor: 'pointer', fontSize: 13 }}>
                    Editar
                  </button>
                  {local.ativo && (
                    <button onClick={() => handleDesativar(local)}
                      style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--warn)', background: 'transparent', color: 'var(--warn)', cursor: 'pointer', fontSize: 13 }}>
                      Desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <LocalModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditLocal(null); }}
        local={editLocal}
      />
    </div>
  );
}

// Helper to parse inline style string into CSSProperties object
function parseStyle(styleStr: string): React.CSSProperties {
  const result: Record<string, string> = {};
  for (const part of styleStr.split(';')) {
    const [k, v] = part.split(':').map((s) => s.trim());
    if (k && v) {
      const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      result[camel] = v;
    }
  }
  return result as React.CSSProperties;
}
