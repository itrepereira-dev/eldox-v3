export interface TrechoConfig {
  id: string;
  nome: string;
  kmInicio: number;
  kmFim: number;
  intervaloKm: number;
  elementoLabel: string;
}

export interface LinearPayload {
  trechos: TrechoConfig[];
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)', padding: '7px 10px',
  color: 'var(--text-100)', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

function TrechoRow({ trecho, index, total, onChange, onRemover }: {
  trecho: TrechoConfig;
  index: number;
  total: number;
  onChange: (t: TrechoConfig) => void;
  onRemover: () => void;
}) {
  const extensao = trecho.kmFim - trecho.kmInicio;
  const pvs = extensao > 0 && trecho.intervaloKm > 0
    ? Math.floor(extensao / trecho.intervaloKm) + 1 : 0;

  return (
    <div style={{
      border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
      padding: '14px', marginBottom: '10px', background: 'var(--bg-surface)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-80)' }}>Trecho {index + 1}</span>
        {total > 1 && (
          <button onClick={onRemover}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-40)', fontSize: '16px' }}>
            ×
          </button>
        )}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>Nome</label>
        <input value={trecho.nome} onChange={(e) => onChange({ ...trecho, nome: e.target.value })}
          placeholder="Ex: Trecho Centro — Norte" style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '6px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>km Início</label>
          <input type="number" step="0.01" min={0} value={trecho.kmInicio}
            onChange={(e) => onChange({ ...trecho, kmInicio: parseFloat(e.target.value) || 0 })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>km Fim</label>
          <input type="number" step="0.01" min={0} value={trecho.kmFim}
            onChange={(e) => onChange({ ...trecho, kmFim: parseFloat(e.target.value) || 0 })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>Intervalo (km)</label>
          <input type="number" step="0.1" min={0.1} value={trecho.intervaloKm}
            onChange={(e) => onChange({ ...trecho, intervaloKm: parseFloat(e.target.value) || 0.1 })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-40)', display: 'block', marginBottom: '4px' }}>Rótulo</label>
          <input value={trecho.elementoLabel}
            onChange={(e) => onChange({ ...trecho, elementoLabel: e.target.value })}
            placeholder="PV" style={inputStyle} />
        </div>
      </div>
      {pvs > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-60)' }}>
          → {pvs} {trecho.elementoLabel || 'PV'}(s) a cada {trecho.intervaloKm} km
        </div>
      )}
    </div>
  );
}

export function LinearForm({ value, onChange }: {
  value: LinearPayload;
  onChange: (v: LinearPayload) => void;
}) {
  const updateTrecho = (i: number, t: TrechoConfig) =>
    onChange({ trechos: value.trechos.map((tr, idx) => (idx === i ? t : tr)) });

  const removerTrecho = (i: number) =>
    onChange({ trechos: value.trechos.filter((_, idx) => idx !== i) });

  const adicionarTrecho = () => {
    const ultimo = value.trechos[value.trechos.length - 1];
    onChange({
      trechos: [
        ...value.trechos,
        {
          id: crypto.randomUUID(),
          nome: '',
          kmInicio: ultimo?.kmFim ?? 0,
          kmFim: (ultimo?.kmFim ?? 0) + 5,
          intervaloKm: ultimo?.intervaloKm ?? 0.5,
          elementoLabel: ultimo?.elementoLabel ?? 'PV',
        },
      ],
    });
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {value.trechos.map((t, i) => (
        <TrechoRow key={t.id} trecho={t} index={i} total={value.trechos.length}
          onChange={(t) => updateTrecho(i, t)} onRemover={() => removerTrecho(i)} />
      ))}
      <button onClick={adicionarTrecho}
        style={{
          background: 'transparent', border: '1px dashed var(--bg-border)',
          color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
          padding: '8px', cursor: 'pointer', fontSize: '13px', width: '100%',
        }}>
        + Adicionar trecho
      </button>
    </div>
  );
}
