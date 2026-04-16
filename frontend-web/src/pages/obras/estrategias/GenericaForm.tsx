export interface NivelGenerico {
  nivel: number;
  prefixo: string;
  qtde: number;
}

export interface GenericaPayload {
  niveis: NivelGenerico[];
  maxNiveis?: number;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)', padding: '8px 10px',
  color: 'var(--text-100)', fontSize: '13px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

export function GenericaForm({ value, onChange }: {
  value: GenericaPayload;
  onChange: (v: GenericaPayload) => void;
}) {
  const maxNiveis = value.maxNiveis ?? 6;

  const atualizar = (idx: number, campo: 'prefixo' | 'qtde', val: string | number) => {
    onChange({
      ...value,
      niveis: value.niveis.map((n, i) => i === idx ? { ...n, [campo]: val } : n),
    });
  };

  const adicionar = () => {
    if (value.niveis.length >= maxNiveis) return;
    onChange({
      ...value,
      niveis: [...value.niveis, { nivel: value.niveis.length + 1, prefixo: '', qtde: 1 }],
    });
  };

  const removerUltimo = () => {
    if (value.niveis.length <= 1) return;
    onChange({ ...value, niveis: value.niveis.slice(0, -1) });
  };

  const totalUltimoNivel = value.niveis.reduce((acc, n) => acc * n.qtde, 1);

  return (
    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 36px', gap: '8px', marginBottom: '2px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-40)' }}>Nív.</span>
        <span style={{ fontSize: '11px', color: 'var(--text-40)' }}>Prefixo</span>
        <span style={{ fontSize: '11px', color: 'var(--text-40)' }}>Qtde</span>
        <span />
      </div>

      {value.niveis.map((n, i) => (
        <div
          key={i}
          style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 100px 36px',
            gap: '8px', alignItems: 'center',
          }}
        >
          <span style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 600, color: 'var(--text-60)',
          }}>
            {n.nivel}
          </span>
          <input
            value={n.prefixo}
            onChange={(e) => atualizar(i, 'prefixo', e.target.value)}
            placeholder={`Prefixo do nível ${n.nivel} (ex: Bloco, Andar, Apto)`}
            style={inputStyle}
            autoFocus={i === 0}
          />
          <input
            type="number"
            min={1}
            max={500}
            value={n.qtde}
            onChange={(e) => atualizar(i, 'qtde', parseInt(e.target.value) || 1)}
            style={inputStyle}
          />
          <button
            onClick={removerUltimo}
            disabled={i !== value.niveis.length - 1 || value.niveis.length === 1}
            style={{
              background: 'none', border: 'none',
              color: i === value.niveis.length - 1 && value.niveis.length > 1 ? 'var(--text-40)' : 'transparent',
              cursor: i === value.niveis.length - 1 && value.niveis.length > 1 ? 'pointer' : 'default',
              fontSize: '18px', padding: 0,
            }}
            title="Remover nível"
          >
            ×
          </button>
        </div>
      ))}

      {value.niveis.length < maxNiveis && (
        <button
          onClick={adicionar}
          style={{
            background: 'transparent', border: '1px dashed var(--bg-border)',
            color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
            padding: '7px 14px', cursor: 'pointer', fontSize: '13px', width: '100%',
            marginTop: '4px',
          }}
        >
          + Adicionar nível
        </button>
      )}

      {value.niveis.some((n) => n.prefixo.trim()) && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)', padding: '10px 14px',
          fontSize: '12px', color: 'var(--text-60)', marginTop: '4px',
        }}>
          Exemplo: {value.niveis.map((n) => `${n.prefixo.trim() || `N${n.nivel}`} 01`).join(' › ')}
          {' '}· total último nível ≈{' '}
          <strong style={{ color: 'var(--text-80)' }}>
            {totalUltimoNivel.toLocaleString('pt-BR')}
          </strong>
        </div>
      )}
    </div>
  );
}
