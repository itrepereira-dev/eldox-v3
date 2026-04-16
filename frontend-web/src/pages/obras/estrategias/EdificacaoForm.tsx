import { useState } from 'react';

export interface EdificacaoPayload {
  condominios: number;
  condInicio: number;
  blocos: number;
  blocoLabel: 'letra' | 'numero';
  andarQtd: number;
  andarInicio: number;
  unidadesPorAndar: number;
  modoUnidade: 'andar' | 'sequencial';
  areasComuns: string[];
  areasGlobais: string[];
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)', padding: '8px 10px',
  color: 'var(--text-100)', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

function TagList({ items, placeholder, onChange }: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const adicionar = () => {
    const v = input.trim();
    if (v && !items.includes(v)) { onChange([...items, v]); setInput(''); }
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          placeholder={placeholder} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={adicionar} style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
          padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
        }}>+</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {items.map((item) => (
            <span key={item} style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-sm)', padding: '3px 8px',
              fontSize: '12px', color: 'var(--text-80)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              {item}
              <button onClick={() => onChange(items.filter((i) => i !== item))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-40)', fontSize: '14px', padding: '0' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EdificacaoForm({ value, onChange }: {
  value: EdificacaoPayload;
  onChange: (v: EdificacaoPayload) => void;
}) {
  const set = <K extends keyof EdificacaoPayload>(key: K, val: EdificacaoPayload[K]) =>
    onChange({ ...value, [key]: val });

  const totalUnidades = value.condominios * value.blocos * value.andarQtd * value.unidadesPorAndar;

  return (
    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Nº de condomínios</label>
          <input type="number" min={1} max={20} value={value.condominios}
            onChange={(e) => set('condominios', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Início da numeração</label>
          <input type="number" min={1} value={value.condInicio}
            onChange={(e) => set('condInicio', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Nº de blocos por condomínio</label>
          <input type="number" min={1} max={26} value={value.blocos}
            onChange={(e) => set('blocos', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Rótulo do bloco</label>
          <select value={value.blocoLabel} onChange={(e) => set('blocoLabel', e.target.value as 'letra' | 'numero')} style={inputStyle}>
            <option value="letra">Letra (A, B, C…)</option>
            <option value="numero">Número (1, 2, 3…)</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Andares por bloco</label>
          <input type="number" min={0} max={200} value={value.andarQtd}
            onChange={(e) => set('andarQtd', parseInt(e.target.value) || 0)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Andar inicial</label>
          <input type="number" min={0} value={value.andarInicio}
            onChange={(e) => set('andarInicio', parseInt(e.target.value) || 0)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Unidades por andar</label>
          <input type="number" min={1} max={100} value={value.unidadesPorAndar}
            onChange={(e) => set('unidadesPorAndar', parseInt(e.target.value) || 1)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Numeração das unidades</label>
          <select value={value.modoUnidade} onChange={(e) => set('modoUnidade', e.target.value as 'andar' | 'sequencial')} style={inputStyle}>
            <option value="andar">Por andar (101, 201…)</option>
            <option value="sequencial">Sequencial (01, 02…)</option>
          </select>
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Áreas comuns (por bloco) — opcional</label>
        <TagList items={value.areasComuns} placeholder="Ex: Garagem, Salão de Festas"
          onChange={(items) => set('areasComuns', items)} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-60)', marginBottom: '5px' }}>Áreas globais (condomínio) — opcional</label>
        <TagList items={value.areasGlobais} placeholder="Ex: Portaria, Guarita"
          onChange={(items) => set('areasGlobais', items)} />
      </div>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px',
        fontSize: '12px', color: 'var(--text-60)',
      }}>
        Estimativa: <strong style={{ color: 'var(--text-80)' }}>{totalUnidades.toLocaleString('pt-BR')}</strong> unidades
        {value.condominios > 1 && ` em ${value.condominios} condomínios`}
        {value.areasComuns.length > 0 && ` + ${value.areasComuns.length} área(s) comum(ns) por bloco`}
        {value.areasGlobais.length > 0 && ` + ${value.areasGlobais.length} área(s) global(is)`}
      </div>
    </div>
  );
}
