// frontend-web/src/modules/diario/pages/RdoFormPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  rdoService,
  type RdoClima,
  type RdoMaoObra,
  type RdoEquipamento,
  type RdoAtividade,
  type RdoOcorrencia,
  type RdoChecklistItem,
  type CondicaoClima,
  type TipoMaoObra,
} from '../../../services/rdo.service';

// ── SVG icons ─────────────────────────────────────────────────────────────────

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.75 3.5h10.5M5.25 3.5V2.333A.583.583 0 0 1 5.833 1.75h2.334A.583.583 0 0 1 8.75 2.333V3.5M11.083 3.5l-.583 8.167a.583.583 0 0 1-.583.583H4.083a.583.583 0 0 1-.583-.583L2.917 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 9V2M4 5l3-3 3 3M2.5 10.5h9M2.5 12.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastState { msg: string; type: 'ok' | 'err' }

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        padding: '12px 16px',
        borderRadius: 'var(--r-md)',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${toast.type === 'ok' ? 'var(--ok)' : 'var(--nc)'}`,
        color: 'var(--text-high)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        userSelect: 'none',
        maxWidth: 320,
      }}
    >
      {toast.msg}
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const show = useCallback((msg: string, type: 'ok' | 'err') => setToast({ msg, type }), []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}

// ── Accordion ────────────────────────────────────────────────────────────────

function AccordionSection({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge?: string | number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '14px 18px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-high)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        <span style={{ flex: 1 }}>{title}</span>
        {badge !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-faint)',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--r-sm)',
              padding: '2px 7px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {badge}
          </span>
        )}
        <span style={{ color: 'var(--text-faint)', display: 'flex' }}>
          {open ? <IconChevronUp /> : <IconChevronDown />}
        </span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--border-dim)', padding: '18px 18px 20px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-high)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  background: 'var(--bg-raised)',
  color: 'var(--text-high)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
};

const btnDanger: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--nc)',
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 'var(--r-sm)',
  display: 'flex',
  alignItems: 'center',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-faint)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  textAlign: 'left' as const,
  background: 'var(--bg-raised)',
  borderBottom: '1px solid var(--border-dim)',
  whiteSpace: 'nowrap' as const,
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border-dim)',
  verticalAlign: 'middle',
};

function SectionFooter({
  onSave,
  saving,
  error,
  disabled,
  label,
}: {
  onSave: () => void;
  saving: boolean;
  error: string | null;
  disabled: boolean;
  label: string;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      {error && (
        <p style={{ color: 'var(--nc)', fontSize: 12, marginBottom: 8 }}>{error}</p>
      )}
      <button
        onClick={onSave}
        disabled={disabled || saving}
        style={{
          ...btnPrimary,
          opacity: disabled || saving ? 0.5 : 1,
          cursor: disabled || saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Salvando...' : label}
      </button>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonBlock({ h = 18, w = '100%' }: { h?: number; w?: string | number }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: 'var(--r-sm)',
        background: 'var(--bg-raised)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SkeletonBlock h={28} w="40%" />
      <SkeletonBlock h={18} w="60%" />
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} h={52} />)}
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  preenchendo: 'Preenchendo',
  revisao: 'Em Revisão',
  aprovado: 'Aprovado',
  cancelado: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  preenchendo: 'var(--run)',
  revisao: 'var(--warn)',
  aprovado: 'var(--ok)',
  cancelado: 'var(--nc)',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 'var(--r-sm)',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-ui)',
        color: STATUS_COLOR[status] ?? 'var(--text-faint)',
        background: 'var(--bg-raised)',
        border: `1px solid ${STATUS_COLOR[status] ?? 'var(--border)'}`,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Seção 1: Clima ────────────────────────────────────────────────────────────

const CONDICAO_LABELS: Record<CondicaoClima, string> = {
  ensolarado: 'Ensolarado',
  nublado: 'Nublado',
  chuvoso: 'Chuvoso',
  parcialmente_nublado: 'Parcialmente Nublado',
  tempestade: 'Tempestade',
};

const PERIODOS: Array<{ key: 'manha' | 'tarde' | 'noite'; label: string }> = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'noite', label: 'Noite' },
];

interface ClimaLocal {
  periodo: 'manha' | 'tarde' | 'noite';
  condicao: CondicaoClima;
  praticavel: boolean;
  chuva_mm: string;
  sugerido_por_ia: boolean;
}


function climaFromApi(apiData: RdoClima[]): ClimaLocal[] {
  return PERIODOS.map(p => {
    const found = apiData.find(c => c.periodo === p.key);
    return {
      periodo: p.key,
      condicao: found?.condicao ?? 'ensolarado',
      praticavel: found?.praticavel ?? true,
      chuva_mm: found?.chuva_mm != null ? String(found.chuva_mm) : '',
      sugerido_por_ia: found?.sugerido_por_ia ?? false,
    };
  });
}

function ClimaSection({
  rdoId,
  inicial,
  readonly,
  onSaved,
}: {
  rdoId: number;
  inicial: RdoClima[];
  readonly: boolean;
  onSaved: (msg: string) => void;
}) {
  const [items, setItems] = useState<ClimaLocal[]>(() => climaFromApi(inicial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setItems(climaFromApi(inicial)); }, [inicial]);

  function update(idx: number, patch: Partial<ClimaLocal>) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await rdoService.upsertClima(rdoId, {
        itens: items.map(it => ({
          periodo: it.periodo,
          condicao: it.condicao,
          praticavel: it.praticavel,
          chuva_mm: it.chuva_mm !== '' ? Number(it.chuva_mm) : undefined,
          aplicado_pelo_usuario: true,
        })),
      });
      onSaved('Clima salvo com sucesso');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar clima';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {items.map((item, idx) => (
          <div
            key={item.periodo}
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--r-md)',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-high)', fontFamily: 'var(--font-ui)' }}>
                {PERIODOS[idx].label}
              </span>
              {item.sugerido_por_ia && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--run)',
                    background: 'rgba(88,166,255,0.1)',
                    border: '1px solid rgba(88,166,255,0.2)',
                    borderRadius: 'var(--r-sm)',
                    padding: '2px 6px',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  IA
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select
                value={item.condicao}
                disabled={readonly}
                onChange={e => update(idx, { condicao: e.target.value as CondicaoClima })}
                style={selectStyle}
              >
                {Object.entries(CONDICAO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: readonly ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  color: 'var(--text-high)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <input
                  type="checkbox"
                  checked={item.praticavel}
                  disabled={readonly}
                  onChange={e => update(idx, { praticavel: e.target.checked })}
                  style={{ accentColor: 'var(--ok)', width: 14, height: 14 }}
                />
                Praticável
              </label>

              <input
                type="number"
                min={0}
                step={0.1}
                placeholder="Chuva (mm)"
                value={item.chuva_mm}
                disabled={readonly}
                onChange={e => update(idx, { chuva_mm: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>
        ))}
      </div>
      <SectionFooter onSave={handleSave} saving={saving} error={error} disabled={readonly} label="Salvar Clima" />
    </div>
  );
}

// ── Seção 2: Mão de Obra ──────────────────────────────────────────────────────

interface MaoObraLocal {
  _key: number;
  funcao: string;
  quantidade: string;
  tipo: TipoMaoObra;
  hora_entrada: string;
  hora_saida: string;
}

let maoObraKey = 0;
function mkMaoObraKey() { return ++maoObraKey; }

function maoObraFromApi(data: RdoMaoObra[]): MaoObraLocal[] {
  return data.map(item => ({
    _key: mkMaoObraKey(),
    funcao: item.funcao,
    quantidade: String(item.quantidade),
    tipo: item.tipo,
    hora_entrada: item.hora_entrada ?? '',
    hora_saida: item.hora_saida ?? '',
  }));
}

function MaoObraSection({
  rdoId,
  inicial,
  readonly,
  onSaved,
}: {
  rdoId: number;
  inicial: RdoMaoObra[];
  readonly: boolean;
  onSaved: (msg: string) => void;
}) {
  const [rows, setRows] = useState<MaoObraLocal[]>(() => maoObraFromApi(inicial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setRows(maoObraFromApi(inicial)); }, [inicial]);

  function add() {
    setRows(prev => [...prev, { _key: mkMaoObraKey(), funcao: '', quantidade: '1', tipo: 'proprio', hora_entrada: '', hora_saida: '' }]);
  }

  function remove(key: number) {
    setRows(prev => prev.filter(r => r._key !== key));
  }

  function update(key: number, patch: Partial<MaoObraLocal>) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await rdoService.substituirMaoObra(rdoId, {
        itens: rows.map(r => ({
          funcao: r.funcao,
          quantidade: Number(r.quantidade) || 0,
          tipo: r.tipo,
          hora_entrada: r.hora_entrada || undefined,
          hora_saida: r.hora_saida || undefined,
        })),
      });
      onSaved('Mão de obra salva com sucesso');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar mão de obra';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Função</th>
              <th style={{ ...thStyle, width: 80 }}>Qtd</th>
              <th style={{ ...thStyle, width: 140 }}>Tipo</th>
              <th style={{ ...thStyle, width: 100 }}>Entrada</th>
              <th style={{ ...thStyle, width: 100 }}>Saída</th>
              <th style={{ ...thStyle, width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13, padding: '20px 10px' }}>
                  Nenhum registro. Adicione abaixo.
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row._key}>
                <td style={tdStyle}>
                  <input
                    value={row.funcao}
                    disabled={readonly}
                    onChange={e => update(row._key, { funcao: e.target.value })}
                    placeholder="Ex: Pedreiro"
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="number"
                    min={1}
                    value={row.quantidade}
                    disabled={readonly}
                    onChange={e => update(row._key, { quantidade: e.target.value })}
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <select
                    value={row.tipo}
                    disabled={readonly}
                    onChange={e => update(row._key, { tipo: e.target.value as TipoMaoObra })}
                    style={selectStyle}
                  >
                    <option value="proprio">Próprio</option>
                    <option value="subcontratado">Subcontratado</option>
                    <option value="terceirizado">Terceirizado</option>
                  </select>
                </td>
                <td style={tdStyle}>
                  <input
                    type="time"
                    value={row.hora_entrada}
                    disabled={readonly}
                    onChange={e => update(row._key, { hora_entrada: e.target.value })}
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="time"
                    value={row.hora_saida}
                    disabled={readonly}
                    onChange={e => update(row._key, { hora_saida: e.target.value })}
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  {!readonly && (
                    <button onClick={() => remove(row._key)} style={btnDanger} title="Remover">
                      <IconTrash />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readonly && (
        <button onClick={add} style={{ ...btnSecondary, marginTop: 10 }}>
          <IconPlus /> Adicionar
        </button>
      )}
      <SectionFooter onSave={handleSave} saving={saving} error={error} disabled={readonly} label="Salvar Mão de Obra" />
    </div>
  );
}

// ── Seção 3: Equipamentos ─────────────────────────────────────────────────────

interface EquipamentoLocal {
  _key: number;
  nome: string;
  quantidade: string;
}

let eqKey = 0;
function mkEqKey() { return ++eqKey; }

function equipamentosFromApi(data: RdoEquipamento[]): EquipamentoLocal[] {
  return data.map(item => ({ _key: mkEqKey(), nome: item.nome, quantidade: String(item.quantidade) }));
}

function EquipamentosSection({
  rdoId,
  inicial,
  readonly,
  onSaved,
}: {
  rdoId: number;
  inicial: RdoEquipamento[];
  readonly: boolean;
  onSaved: (msg: string) => void;
}) {
  const [rows, setRows] = useState<EquipamentoLocal[]>(() => equipamentosFromApi(inicial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setRows(equipamentosFromApi(inicial)); }, [inicial]);

  function add() {
    setRows(prev => [...prev, { _key: mkEqKey(), nome: '', quantidade: '1' }]);
  }

  function remove(key: number) {
    setRows(prev => prev.filter(r => r._key !== key));
  }

  function update(key: number, patch: Partial<EquipamentoLocal>) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await rdoService.substituirEquipamentos(rdoId, {
        itens: rows.map(r => ({ nome: r.nome, quantidade: Number(r.quantidade) || 0 })),
      });
      onSaved('Equipamentos salvos com sucesso');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar equipamentos';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Nome do Equipamento</th>
              <th style={{ ...thStyle, width: 100 }}>Quantidade</th>
              <th style={{ ...thStyle, width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13, padding: '20px 10px' }}>
                  Nenhum equipamento. Adicione abaixo.
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row._key}>
                <td style={tdStyle}>
                  <input
                    value={row.nome}
                    disabled={readonly}
                    onChange={e => update(row._key, { nome: e.target.value })}
                    placeholder="Ex: Betoneira"
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="number"
                    min={1}
                    value={row.quantidade}
                    disabled={readonly}
                    onChange={e => update(row._key, { quantidade: e.target.value })}
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  {!readonly && (
                    <button onClick={() => remove(row._key)} style={btnDanger} title="Remover">
                      <IconTrash />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readonly && (
        <button onClick={add} style={{ ...btnSecondary, marginTop: 10 }}>
          <IconPlus /> Adicionar
        </button>
      )}
      <SectionFooter onSave={handleSave} saving={saving} error={error} disabled={readonly} label="Salvar Equipamentos" />
    </div>
  );
}

// ── Seção 4: Atividades ───────────────────────────────────────────────────────

interface AtividadeLocal {
  _key: number;
  descricao: string;
  progresso_pct: string;
  progresso_pct_anterior: number | null;
  hora_inicio: string;
  hora_fim: string;
  ordem: number;
}

let atKey = 0;
function mkAtKey() { return ++atKey; }

function atividadesFromApi(data: RdoAtividade[]): AtividadeLocal[] {
  return data.map(item => ({
    _key: mkAtKey(),
    descricao: item.descricao,
    progresso_pct: String(item.progresso_pct),
    progresso_pct_anterior: item.progresso_pct_anterior,
    hora_inicio: item.hora_inicio ?? '',
    hora_fim: item.hora_fim ?? '',
    ordem: item.ordem,
  }));
}

function AtividadesSection({
  rdoId,
  inicial,
  readonly,
  onSaved,
}: {
  rdoId: number;
  inicial: RdoAtividade[];
  readonly: boolean;
  onSaved: (msg: string) => void;
}) {
  const [rows, setRows] = useState<AtividadeLocal[]>(() => atividadesFromApi(inicial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setRows(atividadesFromApi(inicial)); }, [inicial]);

  function add() {
    setRows(prev => [...prev, {
      _key: mkAtKey(),
      descricao: '',
      progresso_pct: '0',
      progresso_pct_anterior: null,
      hora_inicio: '',
      hora_fim: '',
      ordem: prev.length + 1,
    }]);
  }

  function remove(key: number) {
    setRows(prev => prev.filter(r => r._key !== key));
  }

  function update(key: number, patch: Partial<AtividadeLocal>) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r));
  }

  function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Skip header row if first cell looks like a header
        const dataRows = jsonRows.length > 1 && typeof jsonRows[0][0] === 'string' &&
          (jsonRows[0][0] as string).toLowerCase().includes('descri')
          ? jsonRows.slice(1)
          : jsonRows;

        const importadas: AtividadeLocal[] = dataRows
          .filter((row): row is unknown[] => Array.isArray(row) && row.length > 0 && row[0] != null && String(row[0]).trim() !== '')
          .map((row, idx) => ({
            _key: mkAtKey(),
            descricao: String(row[0] ?? '').trim(),
            progresso_pct: row[1] != null ? String(Math.min(100, Math.max(0, Number(row[1]) || 0))) : '0',
            progresso_pct_anterior: null,
            hora_inicio: row[2] != null ? String(row[2]).trim() : '',
            hora_fim: row[3] != null ? String(row[3]).trim() : '',
            ordem: idx + 1,
          }));

        if (importadas.length > 0) {
          setImportError(null);
          setRows(prev => [...prev, ...importadas]);
        }
      } catch {
        setImportError('Arquivo inválido — verifique o formato da planilha (colunas: descricao | progresso_pct | hora_inicio | hora_fim)');
      }
      // Reset input so same file can be re-imported
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await rdoService.substituirAtividades(rdoId, {
        itens: rows.map((r, idx) => ({
          descricao: r.descricao,
          progresso_pct: Math.min(100, Math.max(0, Number(r.progresso_pct) || 0)),
          ordem: idx + 1,
          hora_inicio: r.hora_inicio || undefined,
          hora_fim: r.hora_fim || undefined,
        })),
      });
      onSaved('Atividades salvas com sucesso');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar atividades';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            Nenhuma atividade. Adicione abaixo.
          </p>
        )}
        {rows.map(row => (
          <div
            key={row._key}
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--r-md)',
              padding: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <textarea
                  value={row.descricao}
                  disabled={readonly}
                  onChange={e => update(row._key, { descricao: e.target.value })}
                  placeholder="Descreva a atividade realizada..."
                  rows={2}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontFamily: 'var(--font-ui)',
                  }}
                />
              </div>
              {!readonly && (
                <button onClick={() => remove(row._key)} style={btnDanger} title="Remover">
                  <IconTrash />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ minWidth: 160 }}>
                <label style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
                  Progresso (%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={row.progresso_pct}
                    disabled={readonly}
                    onChange={e => update(row._key, { progresso_pct: e.target.value })}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.progresso_pct}
                    disabled={readonly}
                    onChange={e => update(row._key, { progresso_pct: e.target.value })}
                    style={{ ...inputStyle, width: 64 }}
                  />
                </div>
                {row.progresso_pct_anterior != null && (
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                    anterior: {row.progresso_pct_anterior}%
                  </span>
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
                  Hora início
                </label>
                <input
                  type="time"
                  value={row.hora_inicio}
                  disabled={readonly}
                  onChange={e => update(row._key, { hora_inicio: e.target.value })}
                  style={{ ...inputStyle, width: 120 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
                  Hora fim
                </label>
                <input
                  type="time"
                  value={row.hora_fim}
                  disabled={readonly}
                  onChange={e => update(row._key, { hora_fim: e.target.value })}
                  style={{ ...inputStyle, width: 120 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {!readonly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={add} style={btnSecondary}>
            <IconPlus /> Adicionar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={btnSecondary}
            title="Importar planilha Excel/CSV — colunas: descricao | progresso_pct | hora_inicio | hora_fim"
          >
            <IconUpload /> Importar Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportExcel}
            style={{ display: 'none' }}
          />
        </div>
      )}
      {importError && (
        <p style={{ fontSize: 12, color: 'var(--nc)', marginTop: 6, fontFamily: 'var(--font-ui)' }}>
          {importError}
        </p>
      )}
      <SectionFooter onSave={handleSave} saving={saving} error={error} disabled={readonly} label="Salvar Atividades" />
    </div>
  );
}

// ── Seção 5: Ocorrências ──────────────────────────────────────────────────────

interface OcorrenciaLocal {
  _key: number;
  descricao: string;
  tags: string[];
  tagInput: string;
}

let ocKey = 0;
function mkOcKey() { return ++ocKey; }

function ocorrenciasFromApi(data: RdoOcorrencia[]): OcorrenciaLocal[] {
  return data.map(item => ({
    _key: mkOcKey(),
    descricao: item.descricao,
    tags: item.tags ?? [],
    tagInput: '',
  }));
}

function OcorrenciasSection({
  rdoId,
  inicial,
  readonly,
  onSaved,
}: {
  rdoId: number;
  inicial: RdoOcorrencia[];
  readonly: boolean;
  onSaved: (msg: string) => void;
}) {
  const [items, setItems] = useState<OcorrenciaLocal[]>(() => ocorrenciasFromApi(inicial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setItems(ocorrenciasFromApi(inicial)); }, [inicial]);

  function add() {
    setItems(prev => [...prev, { _key: mkOcKey(), descricao: '', tags: [], tagInput: '' }]);
  }

  function remove(key: number) {
    setItems(prev => prev.filter(r => r._key !== key));
  }

  function update(key: number, patch: Partial<OcorrenciaLocal>) {
    setItems(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r));
  }

  function addTag(key: number) {
    setItems(prev => prev.map(r => {
      if (r._key !== key || !r.tagInput.trim()) return r;
      const tag = r.tagInput.trim();
      if (r.tags.includes(tag)) return { ...r, tagInput: '' };
      return { ...r, tags: [...r.tags, tag], tagInput: '' };
    }));
  }

  function removeTag(key: number, tag: string) {
    setItems(prev => prev.map(r => r._key === key ? { ...r, tags: r.tags.filter(t => t !== tag) } : r));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await rdoService.substituirOcorrencias(rdoId, {
        itens: items.map(r => ({ descricao: r.descricao, tags: r.tags.length > 0 ? r.tags : undefined })),
      });
      onSaved('Ocorrências salvas com sucesso');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar ocorrências';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            Nenhuma ocorrência. Adicione abaixo.
          </p>
        )}
        {items.map(item => (
          <div
            key={item._key}
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-dim)',
              borderRadius: 'var(--r-md)',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
              <textarea
                value={item.descricao}
                disabled={readonly}
                onChange={e => update(item._key, { descricao: e.target.value })}
                placeholder="Descreva a ocorrência..."
                rows={3}
                style={{ ...inputStyle, flex: 1, resize: 'vertical', fontFamily: 'var(--font-ui)' }}
              />
              {!readonly && (
                <button onClick={() => remove(item._key)} style={btnDanger} title="Remover ocorrência">
                  <IconTrash />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {item.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--accent-dim)',
                    border: '1px solid rgba(240,136,62,0.2)',
                    fontSize: 11,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 500,
                  }}
                >
                  {tag}
                  {!readonly && (
                    <button
                      onClick={() => removeTag(item._key, tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--accent)',
                        padding: 0,
                        display: 'flex',
                        lineHeight: 1,
                        fontSize: 12,
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {!readonly && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    value={item.tagInput}
                    onChange={e => update(item._key, { tagInput: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(item._key); } }}
                    placeholder="Nova tag"
                    style={{ ...inputStyle, width: 100, fontSize: 11, padding: '4px 8px' }}
                  />
                  <button
                    onClick={() => addTag(item._key)}
                    style={{ ...btnSecondary, padding: '4px 8px' }}
                  >
                    <IconPlus />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {!readonly && (
        <button onClick={add} style={{ ...btnSecondary, marginTop: 10 }}>
          <IconPlus /> Adicionar Ocorrência
        </button>
      )}
      <SectionFooter onSave={handleSave} saving={saving} error={error} disabled={readonly} label="Salvar Ocorrências" />
    </div>
  );
}

// ── Seção 6: Checklist ────────────────────────────────────────────────────────

interface ChecklistLocal {
  _key: number;
  id: number;
  descricao: string;
  marcado: boolean;
  ordem: number;
}

function checklistFromApi(data: RdoChecklistItem[]): ChecklistLocal[] {
  return data.map(item => ({
    _key: item.id,
    id: item.id,
    descricao: item.descricao,
    marcado: item.marcado,
    ordem: item.ordem,
  }));
}

function ChecklistSection({
  rdoId,
  inicial,
  readonly,
  onSaved,
}: {
  rdoId: number;
  inicial: RdoChecklistItem[];
  readonly: boolean;
  onSaved: (msg: string) => void;
}) {
  const [items, setItems] = useState<ChecklistLocal[]>(() => checklistFromApi(inicial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setItems(checklistFromApi(inicial)); }, [inicial]);

  function toggle(key: number) {
    setItems(prev => prev.map(r => r._key === key ? { ...r, marcado: !r.marcado } : r));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await rdoService.substituirChecklist(rdoId, {
        itens: items.map(r => ({ descricao: r.descricao, marcado: r.marcado, ordem: r.ordem })),
      });
      onSaved('Checklist salvo com sucesso');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar checklist';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (items.length === 0) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '32px 20px',
            color: 'var(--text-faint)',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span style={{ fontSize: 28 }}>☑</span>
          Nenhum item de checklist configurado
        </div>
        <SectionFooter onSave={handleSave} saving={saving} error={error} disabled={readonly} label="Salvar Checklist" />
      </div>
    );
  }

  const done = items.filter(i => i.marcado).length;

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
        {done}/{items.length} concluídos
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(item => (
          <label
            key={item._key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              cursor: readonly ? 'not-allowed' : 'pointer',
              background: item.marcado ? 'rgba(63,185,80,0.06)' : 'transparent',
              border: `1px solid ${item.marcado ? 'rgba(63,185,80,0.15)' : 'transparent'}`,
              transition: 'background 0.15s',
            }}
          >
            <div
              onClick={() => !readonly && toggle(item._key)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: `2px solid ${item.marcado ? 'var(--ok)' : 'var(--border)'}`,
                background: item.marcado ? 'var(--ok)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#fff',
                transition: 'all 0.15s',
                cursor: readonly ? 'not-allowed' : 'pointer',
              }}
            >
              {item.marcado && <IconCheck />}
            </div>
            <span
              style={{
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                color: item.marcado ? 'var(--text-low)' : 'var(--text-high)',
                textDecoration: item.marcado ? 'line-through' : 'none',
                flex: 1,
              }}
            >
              {item.descricao}
            </span>
          </label>
        ))}
      </div>
      <SectionFooter onSave={handleSave} saving={saving} error={error} disabled={readonly} label="Salvar Checklist" />
    </div>
  );
}

// ── Sugestões IA — Sidebar ────────────────────────────────────────────────────

const AGENT_LABEL: Record<string, string> = {
  'AGENTE-CLIMA': 'Clima',
  'AGENTE-EQUIPE': 'Equipe',
  'AGENTE-ATIVIDADES': 'Atividades',
};

function IconSparkles() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M7.5 1L8.9 5.1H13.2L9.65 7.65L11.05 11.75L7.5 9.2L3.95 11.75L5.35 7.65L1.8 5.1H6.1L7.5 1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

interface IaSugestao {
  id: number;
  agente: string;
  campo: string;
  valor_sugerido: unknown;
  criado_em: string;
}

function IaSidebar({ rdoId, rdoStatus }: { rdoId: number; rdoStatus: string }) {
  const queryClient = useQueryClient();

  const { data: sugestoes, isLoading } = useQuery<IaSugestao[]>({
    queryKey: ['rdo-sugestoes', rdoId],
    queryFn: () => rdoService.buscarSugestoes(rdoId),
    enabled: rdoStatus !== 'aprovado',
  });

  const [applying, setApplying] = useState<number | null>(null);

  async function handleAcao(s: IaSugestao, acao: 'aplicado' | 'ignorado') {
    setApplying(s.id);
    try {
      await rdoService.aplicarSugestao(rdoId, {
        agente: s.agente,
        campo: s.campo,
        acao,
        ...(acao === 'aplicado' ? { valor_aplicado: s.valor_sugerido } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['rdo-sugestoes', rdoId] });
    } finally {
      setApplying(null);
    }
  }

  // Hidden when approved
  if (rdoStatus === 'aprovado') return null;

  // Hidden after load when empty
  if (!isLoading && (!sugestoes || sugestoes.length === 0)) return null;

  const pendingCount = sugestoes?.length ?? 0;

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        position: 'sticky',
        top: 20,
        alignSelf: 'flex-start',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-high)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span style={{ color: 'var(--accent)', display: 'flex' }}>
          <IconSparkles />
        </span>
        <span style={{ flex: 1 }}>Sugestões IA</span>
        {pendingCount > 0 && (
          <span
            style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 20,
              fontFamily: 'var(--font-ui)',
            }}
          >
            {pendingCount}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 14px 16px' }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  height: 72,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--bg-raised)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        )}

        {!isLoading && sugestoes && sugestoes.length === 0 && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-ui)',
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            Nenhuma sugestão pendente
          </p>
        )}

        {!isLoading && sugestoes && sugestoes.map(s => {
          const valorStr = JSON.stringify(s.valor_sugerido);
          const preview = valorStr.length > 100 ? valorStr.slice(0, 100) + '…' : valorStr;
          const isActing = applying === s.id;
          return (
            <div
              key={s.id}
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--r-md)',
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span
                  style={{
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {AGENT_LABEL[s.agente] ?? s.agente}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-low)',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.campo}
                </span>
              </div>
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  fontFamily: 'var(--font-mono)',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                }}
              >
                {preview}
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={isActing}
                  onClick={() => handleAcao(s, 'aplicado')}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: 'var(--r-sm)',
                    border: 'none',
                    cursor: isActing ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-ui)',
                    opacity: isActing ? 0.6 : 1,
                  }}
                >
                  Aplicar
                </button>
                <button
                  disabled={isActing}
                  onClick={() => handleAcao(s, 'ignorado')}
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--text-low)',
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border-dim)',
                    cursor: isActing ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-ui)',
                    opacity: isActing ? 0.6 : 1,
                  }}
                >
                  Ignorar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

// ── Fotos Section ────────────────────────────────────────────────────────────

interface FotoItem {
  id: number
  url: string
  thumbnail_url: string | null
  nome_arquivo: string
  tamanho_bytes: number
  legenda: string | null
  created_at: string
}

function FotosSection({
  rdoId,
  readonly,
  onMsg,
}: {
  rdoId: number
  readonly: boolean
  onMsg: (msg: string, type: 'ok' | 'err') => void
}) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [legendaInput, setLegendaInput] = useState('')

  const { data: fotos = [], isLoading } = useQuery<FotoItem[]>({
    queryKey: ['rdo-fotos', rdoId],
    queryFn: () => api.get(`/diario/rdos/${rdoId}/fotos`).then(r => r.data),
    enabled: !!rdoId,
  })

  const mutUpload = useMutation({
    mutationFn: ({ base64, mimeType, legenda }: { base64: string; mimeType: string; legenda?: string }) =>
      api.post(`/diario/rdos/${rdoId}/fotos`, { base64, mime_type: mimeType, legenda }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rdo-fotos', rdoId] })
      setLegendaInput('')
      onMsg('Foto enviada com sucesso', 'ok')
    },
    onError: () => onMsg('Erro ao enviar foto', 'err'),
  })

  const mutExcluir = useMutation({
    mutationFn: (fotoId: number) => api.delete(`/diario/rdos/${rdoId}/fotos/${fotoId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rdo-fotos', rdoId] })
      onMsg('Foto removida', 'ok')
    },
    onError: () => onMsg('Erro ao remover foto', 'err'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      // result = "data:image/jpeg;base64,/9j/..."
      const base64 = result.split(',')[1]
      mutUpload.mutate({ base64, mimeType: file.type, legenda: legendaInput || undefined })
    }
    reader.readAsDataURL(file)
    // reset input
    e.target.value = ''
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Upload área */}
      {!readonly && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-low)', marginBottom: 4 }}>
              Legenda (opcional)
            </label>
            <input
              type="text"
              value={legendaInput}
              onChange={(e) => setLegendaInput(e.target.value)}
              placeholder="Ex: Fundação — Pilar P5"
              style={{
                width: '100%',
                height: 34,
                padding: '0 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg-raised)',
                color: 'var(--text-high)',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={mutUpload.isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 14px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              fontSize: 13,
              fontWeight: 500,
              cursor: mutUpload.isPending ? 'not-allowed' : 'pointer',
              opacity: mutUpload.isPending ? 0.6 : 1,
            }}
          >
            {mutUpload.isPending ? 'Enviando…' : '+ Adicionar foto'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Grid de fotos */}
      {isLoading ? (
        <div style={{ fontSize: 13, color: 'var(--text-low)' }}>Carregando fotos…</div>
      ) : fotos.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-low)', textAlign: 'center', padding: '24px 0' }}>
          Nenhuma foto registrada neste RDO.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {fotos.map((foto) => (
            <div
              key={foto.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                overflow: 'hidden',
                background: 'var(--bg-raised)',
                position: 'relative',
              }}
            >
              <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-void)', overflow: 'hidden' }}>
                <img
                  src={foto.thumbnail_url ?? foto.url}
                  alt={foto.legenda ?? foto.nome_arquivo}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => window.open(foto.url, '_blank')}
                />
              </div>
              <div style={{ padding: '8px 10px' }}>
                {foto.legenda && (
                  <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 500, color: 'var(--text-high)' }}>
                    {foto.legenda}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-low)' }}>
                  {formatBytes(foto.tamanho_bytes)}
                </p>
              </div>
              {!readonly && (
                <button
                  onClick={() => {
                    if (confirm('Remover esta foto?')) mutExcluir.mutate(foto.id)
                  }}
                  title="Remover foto"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ações de exportação */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button
          type="button"
          onClick={async () => {
            const resp = await api.get(`/diario/rdos/${rdoId}/exportar-xls`, { responseType: 'blob' });
            const url = URL.createObjectURL(resp.data as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rdo-${rdoId}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--bg-raised)',
            color: 'var(--text-high)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ↓ Exportar XLS
        </button>
        <button
          type="button"
          onClick={async () => {
            const resp = await api.get(`/diario/rdos/${rdoId}/pdf?fotos=true`, { responseType: 'blob' });
            const url = URL.createObjectURL(resp.data as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rdo-${rdoId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--bg-raised)',
            color: 'var(--text-high)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ↓ PDF com fotos
        </button>
      </div>
    </div>
  )
}

// ── Compartilhamento ─────────────────────────────────────────────────────────

const SECTIONS = ['clima', 'maoObra', 'equipamentos', 'atividades', 'ocorrencias', 'checklist', 'fotos'] as const;
type SectionKey = typeof SECTIONS[number];

export function RdoFormPage() {
  const { id: obraId, rdoId } = useParams<{ id: string; rdoId: string }>();
  const rdoIdNum = Number(rdoId);

  const { data: rdo, isLoading, error: queryError } = useQuery({
    queryKey: ['rdo', rdoIdNum],
    queryFn: () => rdoService.buscar(rdoIdNum),
    enabled: !!rdoIdNum,
  });

  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    clima: true,
    maoObra: false,
    equipamentos: false,
    atividades: false,
    ocorrencias: false,
    checklist: false,
    fotos: false,
  });

  const { toast, show: showToast, dismiss } = useToast();

  function toggleSection(key: SectionKey) {
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const readonly = rdo?.status === 'aprovado';

  if (isLoading) return <LoadingSkeleton />;

  if (queryError || !rdo) {
    return (
      <div
        style={{
          padding: 32,
          color: 'var(--nc)',
          fontFamily: 'var(--font-ui)',
          fontSize: 14,
        }}
      >
        Erro ao carregar RDO. Verifique a conexão e tente novamente.
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-void)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      {toast && <Toast toast={toast} onDismiss={dismiss} />}

      {/* Faixa de aprovado */}
      {rdo.status === 'aprovado' && (
        <div
          style={{
            background: 'rgba(210,153,30,0.12)',
            borderBottom: '1px solid rgba(210,153,30,0.3)',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'var(--warn)',
            fontWeight: 500,
          }}
        >
          <span>⚠</span>
          Este RDO está aprovado e não pode ser editado
        </div>
      )}

      {/* Header fixo */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-faint)' }}>
          <Link
            to="/obras"
            style={{ color: 'var(--text-faint)', textDecoration: 'none' }}
          >
            Obras
          </Link>
          <span>/</span>
          {rdo.obra_nome ? (
            <Link
              to={`/obras/${obraId}`}
              style={{ color: 'var(--text-faint)', textDecoration: 'none' }}
            >
              {rdo.obra_nome}
            </Link>
          ) : (
            <span>Obra</span>
          )}
          <span>/</span>
          <Link
            to={`/obras/${obraId}/diario`}
            style={{ color: 'var(--text-faint)', textDecoration: 'none' }}
          >
            Diário
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-low)' }}>RDO #{rdo.numero}</span>
        </nav>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-high)',
            }}
          >
            RDO #{rdo.numero} — {formatDate(rdo.data)}
          </h1>
          <StatusBadge status={rdo.status} />
        </div>

        <Link
          to={`../workflow`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            color: 'var(--text-high)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Fluxo de Aprovação →
        </Link>
      </div>

      {/* Corpo */}
      <div style={{ padding: '24px', maxWidth: 1460, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* Coluna principal — accordions */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Resumo IA (se disponível) */}
            {rdo.resumo_ia && (
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderLeft: '3px solid var(--run)',
                  borderRadius: 'var(--r-md)',
                  padding: '12px 16px',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--run)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Resumo por IA
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-high)', lineHeight: 1.6 }}>{rdo.resumo_ia}</p>
              </div>
            )}

            {/* Seção 1 — Clima */}
            <AccordionSection
              title="Clima"
              badge={rdo.clima.length}
              open={open.clima}
              onToggle={() => toggleSection('clima')}
            >
              <ClimaSection
                rdoId={rdoIdNum}
                inicial={rdo.clima}
                readonly={readonly}
                onSaved={msg => showToast(msg, 'ok')}
              />
            </AccordionSection>

            {/* Seção 2 — Mão de Obra */}
            <AccordionSection
              title="Mão de Obra"
              badge={rdo.mao_obra.length}
              open={open.maoObra}
              onToggle={() => toggleSection('maoObra')}
            >
              <MaoObraSection
                rdoId={rdoIdNum}
                inicial={rdo.mao_obra}
                readonly={readonly}
                onSaved={msg => showToast(msg, 'ok')}
              />
            </AccordionSection>

            {/* Seção 3 — Equipamentos */}
            <AccordionSection
              title="Equipamentos"
              badge={rdo.equipamentos.length}
              open={open.equipamentos}
              onToggle={() => toggleSection('equipamentos')}
            >
              <EquipamentosSection
                rdoId={rdoIdNum}
                inicial={rdo.equipamentos}
                readonly={readonly}
                onSaved={msg => showToast(msg, 'ok')}
              />
            </AccordionSection>

            {/* Seção 4 — Atividades */}
            <AccordionSection
              title="Atividades"
              badge={rdo.atividades.length}
              open={open.atividades}
              onToggle={() => toggleSection('atividades')}
            >
              <AtividadesSection
                rdoId={rdoIdNum}
                inicial={rdo.atividades}
                readonly={readonly}
                onSaved={msg => showToast(msg, 'ok')}
              />
            </AccordionSection>

            {/* Seção 5 — Ocorrências */}
            <AccordionSection
              title="Ocorrências"
              badge={rdo.ocorrencias.length}
              open={open.ocorrencias}
              onToggle={() => toggleSection('ocorrencias')}
            >
              <OcorrenciasSection
                rdoId={rdoIdNum}
                inicial={rdo.ocorrencias}
                readonly={readonly}
                onSaved={msg => showToast(msg, 'ok')}
              />
            </AccordionSection>

            {/* Seção 6 — Checklist */}
            <AccordionSection
              title="Checklist"
              badge={rdo.checklist.length}
              open={open.checklist}
              onToggle={() => toggleSection('checklist')}
            >
              <ChecklistSection
                rdoId={rdoIdNum}
                inicial={rdo.checklist}
                readonly={readonly}
                onSaved={msg => showToast(msg, 'ok')}
              />
            </AccordionSection>

            {/* Seção 7 — Fotos */}
            <AccordionSection
              title="Registro Fotográfico"
              open={open.fotos}
              onToggle={() => toggleSection('fotos')}
            >
              <FotosSection
                rdoId={rdoIdNum}
                readonly={readonly}
                onMsg={(msg, type) => showToast(msg, type)}
              />
            </AccordionSection>

          </div>

          {/* Coluna lateral — Sugestões IA */}
          <IaSidebar rdoId={rdoIdNum} rdoStatus={rdo.status} />

        </div>
      </div>
    </div>
  );
}
