import { useState } from 'react';

export interface AreaConfig {
  id: string;
  nome: string;
  modulosQtde: number;
  modulosNomes: string[];
  modoModulo: 'qtde' | 'nomes';
}

export interface InstalacaoPayload {
  areas: AreaConfig[];
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)', padding: '7px 10px',
  color: 'var(--text-100)', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

function AreaRow({ area, index, total, onChange, onRemover }: {
  area: AreaConfig;
  index: number;
  total: number;
  onChange: (a: AreaConfig) => void;
  onRemover: () => void;
}) {
  const [novoModulo, setNovoModulo] = useState('');

  const adicionarModulo = () => {
    const v = novoModulo.trim();
    if (v && !area.modulosNomes.includes(v)) {
      onChange({ ...area, modulosNomes: [...area.modulosNomes, v] });
      setNovoModulo('');
    }
  };

  return (
    <div style={{
      border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
      padding: '14px', marginBottom: '10px', background: 'var(--bg-surface)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-80)' }}>Área {index + 1}</span>
        {total > 1 && (
          <button onClick={onRemover}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-40)', fontSize: '16px' }}>×</button>
        )}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>Nome da área</label>
        <input value={area.nome} onChange={(e) => onChange({ ...area, nome: e.target.value })}
          placeholder="Ex: Galpão A, Caldeiraria, Utilidades" style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {(['qtde', 'nomes'] as const).map((modo) => (
          <button key={modo} onClick={() => onChange({ ...area, modoModulo: modo })}
            style={{
              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${area.modoModulo === modo ? 'var(--accent)' : 'var(--bg-border)'}`,
              background: area.modoModulo === modo ? 'var(--accent-dim)' : 'transparent',
              color: area.modoModulo === modo ? 'var(--accent)' : 'var(--text-60)',
              cursor: 'pointer', fontSize: '12px',
            }}>
            {modo === 'qtde' ? 'Por quantidade' : 'Por nome'}
          </button>
        ))}
      </div>
      {area.modoModulo === 'qtde' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="number" min={1} max={500} value={area.modulosQtde}
            onChange={(e) => onChange({ ...area, modulosQtde: parseInt(e.target.value) || 1 })}
            style={{ ...inputStyle, width: '100px' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-60)' }}>módulos numerados</span>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <input value={novoModulo} onChange={(e) => setNovoModulo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarModulo()}
              placeholder="Ex: Caldeira Principal" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={adicionarModulo}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
                padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
              }}>+</button>
          </div>
          {area.modulosNomes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {area.modulosNomes.map((m) => (
                <span key={m} style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius-sm)', padding: '3px 8px',
                  fontSize: '12px', color: 'var(--text-80)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  {m}
                  <button onClick={() => onChange({ ...area, modulosNomes: area.modulosNomes.filter((x) => x !== m) })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-40)', fontSize: '14px', padding: '0' }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InstalacaoForm({ value, onChange }: {
  value: InstalacaoPayload;
  onChange: (v: InstalacaoPayload) => void;
}) {
  const updateArea = (i: number, a: AreaConfig) =>
    onChange({ areas: value.areas.map((ar, idx) => (idx === i ? a : ar)) });

  const removerArea = (i: number) =>
    onChange({ areas: value.areas.filter((_, idx) => idx !== i) });

  const adicionarArea = () =>
    onChange({ areas: [...value.areas, { id: crypto.randomUUID(), nome: '', modulosQtde: 1, modulosNomes: [], modoModulo: 'qtde' }] });

  return (
    <div style={{ marginTop: '16px' }}>
      {value.areas.map((a, i) => (
        <AreaRow key={a.id} area={a} index={i} total={value.areas.length}
          onChange={(a) => updateArea(i, a)} onRemover={() => removerArea(i)} />
      ))}
      <button onClick={adicionarArea}
        style={{
          background: 'transparent', border: '1px dashed var(--bg-border)',
          color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
          padding: '8px', cursor: 'pointer', fontSize: '13px', width: '100%',
        }}>
        + Adicionar área
      </button>
    </div>
  );
}
