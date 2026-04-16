// frontend-web/src/modules/efetivo/components/AlertaEfetivoCard.tsx
import type { AlertaEfetivo } from '../../../services/efetivo.service';

interface Props {
  alertas: AlertaEfetivo[];
  onMarcarLido: (id: number) => void;
}

export function AlertaEfetivoCard({ alertas, onMarcarLido }: Props) {
  if (!alertas.length) return null;

  return (
    <div className="rounded-xl p-4 mb-5 flex items-start gap-3" style={{
      background: 'var(--warn-bg)',
      border: '1px solid var(--warn-border)',
    }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{
        background: 'rgba(210,153,34,.2)',
      }}>
        🤖
      </div>
      <div className="flex-1">
        <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--warn)' }}>
          EfetivoAlerterAgent — {alertas.length} anomalia{alertas.length > 1 ? 's' : ''} detectada{alertas.length > 1 ? 's' : ''}
        </div>
        <div className="space-y-1">
          {alertas.map(a => (
            <div key={a.id} className="text-[12px]" style={{ color: 'var(--text-mid)', lineHeight: '1.5' }}>
              <strong style={{ color: 'var(--text-high)' }}>
                {a.tipo === 'queda_efetivo' && '📉 Queda de efetivo:'}
                {a.tipo === 'empresa_ausente' && '🏢 Empresa ausente:'}
                {a.tipo === 'obra_parada' && '🚧 Obra parada:'}
              </strong>{' '}
              {a.mensagem}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 items-center flex-shrink-0">
        <button
          onClick={() => alertas.forEach(a => onMarcarLido(a.id))}
          className="text-[12px] font-medium px-3 py-1 rounded transition-all"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            color: 'var(--text-mid)',
          }}
        >
          Ignorar todos
        </button>
      </div>
    </div>
  );
}
