// frontend-web/src/modules/efetivo/components/EquipeGrid.tsx
import type { EmpresaEfetivo, FuncaoEfetivo } from '../../../services/efetivo.service';

export interface LinhaEquipe {
  empresaId: number;
  funcaoId:  number;
  quantidade: number;
  observacao?: string;
}

interface Props {
  linhas:    LinhaEquipe[];
  empresas:  EmpresaEfetivo[];
  funcoes:   FuncaoEfetivo[];
  onChange:  (linhas: LinhaEquipe[]) => void;
}

export function EquipeGrid({ linhas, empresas, funcoes, onChange }: Props) {
  const totalHomensDia = linhas.reduce((s, l) => s + (l.quantidade || 0), 0);

  const setLinha = (i: number, partial: Partial<LinhaEquipe>) => {
    const next = linhas.map((l, idx) => idx === i ? { ...l, ...partial } : l);
    onChange(next);
  };

  const addLinha = () => onChange([...linhas, { empresaId: 0, funcaoId: 0, quantidade: 1 }]);
  const delLinha = (i: number) => onChange(linhas.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
      {/* Cabeçalho */}
      <div className="grid text-[10px] font-bold uppercase tracking-wider" style={{
        gridTemplateColumns: '1fr 1fr 90px 36px',
        background: 'var(--bg-void)',
        borderBottom: '1px solid var(--border-dim)',
        color: 'var(--text-faint)',
      }}>
        <span className="px-3 py-2">Empresa</span>
        <span className="px-3 py-2">Função</span>
        <span className="px-3 py-2 text-center">Qtd</span>
        <span />
      </div>

      {/* Linhas */}
      {linhas.map((linha, i) => (
        <div key={i} className="grid items-center" style={{
          gridTemplateColumns: '1fr 1fr 90px 36px',
          borderBottom: '1px solid var(--border-dim)',
          background: i % 2 === 0 ? 'var(--bg-raised)' : 'transparent',
        }}>
          <select
            value={linha.empresaId}
            onChange={e => setLinha(i, { empresaId: Number(e.target.value) })}
            className="w-full px-3 py-2.5 text-[13px] outline-none"
            style={{
              background: 'transparent',
              borderRight: '1px solid var(--border-dim)',
              color: 'var(--text-high)',
              fontFamily: 'inherit',
            }}
          >
            <option value={0} disabled>Selecione...</option>
            {empresas.filter(e => e.ativa).map(e => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>

          <select
            value={linha.funcaoId}
            onChange={e => setLinha(i, { funcaoId: Number(e.target.value) })}
            className="w-full px-3 py-2.5 text-[13px] outline-none"
            style={{
              background: 'transparent',
              borderRight: '1px solid var(--border-dim)',
              color: 'var(--text-high)',
              fontFamily: 'inherit',
            }}
          >
            <option value={0} disabled>Selecione...</option>
            {funcoes.filter(f => f.ativa).map(f => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            value={linha.quantidade}
            onChange={e => setLinha(i, { quantidade: Math.max(1, Number(e.target.value)) })}
            className="w-full px-3 py-2.5 text-[13px] text-center outline-none font-mono"
            style={{
              background: 'transparent',
              borderRight: '1px solid var(--border-dim)',
              color: 'var(--text-high)',
            }}
          />

          <button
            onClick={() => delLinha(i)}
            className="flex items-center justify-center h-full text-lg transition-colors"
            style={{ color: 'var(--text-faint)', background: 'transparent', border: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--nc)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            ×
          </button>
        </div>
      ))}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2" style={{
        borderTop: linhas.length ? '1px solid var(--border-dim)' : 'none',
        background: 'var(--bg-raised)',
      }}>
        <button
          onClick={addLinha}
          className="text-[12px] font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          + Adicionar linha
        </button>
        <span className="text-[12px]" style={{ color: 'var(--text-mid)' }}>
          Total: <strong className="font-mono text-[14px]" style={{ color: 'var(--text-high)' }}>{totalHomensDia}</strong> homens·dia
        </span>
      </div>
    </div>
  );
}
