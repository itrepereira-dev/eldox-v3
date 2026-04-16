// frontend-web/src/modules/efetivo/components/SugestaoIABanner.tsx
import type { SugestaoIA } from '../../../services/efetivo.service';

interface Props {
  sugestao: SugestaoIA;
  onAplicar: (itens: SugestaoIA['itens']) => void;
}

export function SugestaoIABanner({ sugestao, onAplicar }: Props) {
  return (
    <div className="rounded-xl p-4 mb-5" style={{
      background: 'var(--purple-bg)',
      border: '1px solid rgba(163,113,247,.28)',
    }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{
          background: 'rgba(163,113,247,.2)',
          border: '1px solid rgba(163,113,247,.28)',
          color: 'var(--purple)',
        }}>
          ✦ EldoxIA
        </span>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--purple)' }}>
          EfetivoSuggesterAgent — sugestão baseada em {sugestao.base_registros} registros similares
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {sugestao.itens.map((item, i) => (
          <div key={i} className="rounded-md px-2.5 py-1 text-[12px]" style={{
            background: 'rgba(163,113,247,.08)',
            border: '1px solid rgba(163,113,247,.2)',
            color: 'var(--text-mid)',
          }}>
            {item.empresa_nome} · {item.funcao_nome}{' '}
            <span className="font-bold font-mono text-[13px]" style={{ color: 'var(--purple)' }}>
              ×{item.quantidade}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
          Confiança: {sugestao.confianca}% · {sugestao.observacao}
        </span>
        <button
          onClick={() => onAplicar(sugestao.itens)}
          className="text-[12px] font-semibold px-3 py-1 rounded-md transition-all"
          style={{
            background: 'rgba(163,113,247,.15)',
            border: '1px solid rgba(163,113,247,.28)',
            color: 'var(--purple)',
          }}
        >
          ✦ Aplicar sugestão
        </button>
      </div>
    </div>
  );
}
