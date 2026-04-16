// frontend-web/src/modules/fvm/grade/components/EnsaioCard.tsx
// Card para entrada e exibição de um ensaio quantitativo de material

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Check, X, Trash2, Edit2 } from 'lucide-react';
import type { FvmEnsaio } from '@/services/fvm.service';

interface EnsaioCardProps {
  ensaio: FvmEnsaio;
  somenteLeitura?: boolean;
  onAtualizar: (valor: number, laboratorio?: string) => Promise<void>;
  onRemover: () => Promise<void>;
}

function ProgressBar({ valor, min, max }: { valor: number | null; min: number | null; max: number | null }) {
  if (valor == null) return null;
  if (min == null && max == null) return null;

  // Calculate fill position within the [min, max] or [0, max] or [min, max*2] range
  let pct = 0;
  if (max != null && min != null) {
    const range = max - min;
    pct = range > 0 ? Math.min(100, Math.max(0, ((valor - min) / range) * 100)) : 100;
  } else if (max != null) {
    pct = Math.min(100, (valor / max) * 100);
  } else if (min != null) {
    pct = valor >= min ? 100 : (valor / min) * 100;
  }

  const ok = (min == null || valor >= min) && (max == null || valor <= max);

  return (
    <div className="mt-2">
      <div className="h-1 w-full rounded-full bg-[var(--bg-raised)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', ok ? 'bg-[var(--ok-text)]' : 'bg-[var(--nc-text)]')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EnsaioCard({ ensaio, somenteLeitura, onAtualizar, onRemover }: EnsaioCardProps) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(ensaio.valor_medido?.toString() ?? '');
  const [laboratorio, setLaboratorio] = useState(ensaio.laboratorio_nome ?? '');
  const [saving, setSaving] = useState(false);

  async function salvar() {
    const n = parseFloat(valor);
    if (isNaN(n)) return;
    setSaving(true);
    try {
      await onAtualizar(n, laboratorio || undefined);
      setEditando(false);
    } finally {
      setSaving(false);
    }
  }

  const statusColor = {
    APROVADO:  'text-[var(--ok-text)] bg-[var(--ok-bg)] border-[var(--ok-border)]',
    REPROVADO: 'text-[var(--nc-text)] bg-[var(--nc-bg)] border-[var(--nc-border)]',
    PENDENTE:  'text-[var(--text-faint)] bg-[var(--bg-raised)] border-[var(--border-dim)]',
  }[ensaio.resultado];

  const refTexto = [
    ensaio.valor_min != null ? `≥ ${ensaio.valor_min}` : null,
    ensaio.valor_max != null ? `≤ ${ensaio.valor_max}` : null,
  ].filter(Boolean).join(', ');

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        ensaio.resultado === 'APROVADO'  && 'border-[var(--ok-border)] bg-[var(--ok-bg)]',
        ensaio.resultado === 'REPROVADO' && 'border-[var(--nc-border)] bg-[var(--nc-bg)]',
        ensaio.resultado === 'PENDENTE'  && 'border-[var(--border-dim)] bg-[var(--bg-base)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Nome + norma */}
          <p className="text-sm font-medium text-[var(--text-high)] m-0 leading-snug">{ensaio.nome}</p>
          {ensaio.norma_referencia && (
            <p className="text-[10px] text-[var(--text-faint)] m-0 mt-0.5">{ensaio.norma_referencia}</p>
          )}
          {/* Ref */}
          {refTexto && (
            <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5 italic">
              Ref: {refTexto} {ensaio.unidade}
            </p>
          )}
        </div>

        {/* Status badge */}
        <div className={cn('text-[10px] font-bold px-2 py-0.5 rounded border shrink-0', statusColor)}>
          {ensaio.resultado === 'APROVADO' && <span className="flex items-center gap-0.5"><Check size={10} /> OK</span>}
          {ensaio.resultado === 'REPROVADO' && <span className="flex items-center gap-0.5"><X size={10} /> NC</span>}
          {ensaio.resultado === 'PENDENTE' && 'Pendente'}
        </div>
      </div>

      {/* Valor medido */}
      <div className="mt-2">
        {editando ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="Valor medido"
              step="any"
              autoFocus
              className="w-28 text-sm px-2 py-1 rounded border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
            <span className="text-xs text-[var(--text-faint)]">{ensaio.unidade}</span>
            <input
              type="text"
              value={laboratorio}
              onChange={e => setLaboratorio(e.target.value)}
              placeholder="Laboratório (opcional)"
              className="flex-1 text-sm px-2 py-1 rounded border border-[var(--border-dim)] bg-[var(--bg-raised)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={salvar}
              disabled={saving || !valor}
              className="text-xs px-2 py-1 rounded bg-[var(--accent)] text-white disabled:opacity-40"
            >
              {saving ? '…' : 'Salvar'}
            </button>
            <button
              onClick={() => { setEditando(false); setValor(ensaio.valor_medido?.toString() ?? ''); }}
              className="text-xs text-[var(--text-faint)]"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {ensaio.valor_medido != null ? (
              <span className="text-sm font-semibold text-[var(--text-high)]">
                {ensaio.valor_medido} <span className="font-normal text-[var(--text-faint)] text-xs">{ensaio.unidade}</span>
              </span>
            ) : (
              <span className="text-xs text-[var(--text-faint)] italic">Sem valor registrado</span>
            )}
            {ensaio.laboratorio_nome && (
              <span className="text-xs text-[var(--text-faint)]">· {ensaio.laboratorio_nome}</span>
            )}
            {!somenteLeitura && (
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setEditando(true)}
                  className="text-[var(--text-faint)] hover:text-[var(--accent)] transition-colors"
                  title="Editar valor"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={onRemover}
                  className="text-[var(--text-faint)] hover:text-[var(--nc-text)] transition-colors"
                  title="Remover ensaio"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <ProgressBar valor={ensaio.valor_medido} min={ensaio.valor_min} max={ensaio.valor_max} />
    </div>
  );
}
