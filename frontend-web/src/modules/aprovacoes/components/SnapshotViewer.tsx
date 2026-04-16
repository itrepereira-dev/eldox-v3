interface Props {
  snapshot: Record<string, unknown>;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'string') {
    // Try to detect ISO date strings
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      try {
        return new Date(val).toLocaleString('pt-BR');
      } catch {
        return val;
      }
    }
    return val || '—';
  }
  if (typeof val === 'number') return val.toLocaleString('pt-BR');
  if (Array.isArray(val)) return val.length === 0 ? '(vazio)' : `${val.length} item(s)`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

export function SnapshotViewer({ snapshot }: Props) {
  const entries = Object.entries(snapshot).filter(([, v]) => typeof v !== 'object' || v === null);
  const nested = Object.entries(snapshot).filter(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v));

  return (
    <div className="rounded-lg border border-[var(--border-dim)] overflow-hidden bg-[var(--bg-base)]">
      <div className="px-4 py-2.5 border-b border-[var(--border-dim)] bg-[var(--bg-raised)]">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Snapshot do Registro
        </span>
      </div>
      <div className="divide-y divide-[var(--border-dim)]">
        {entries.map(([key, val]) => (
          <div key={key} className="grid grid-cols-[180px_1fr] gap-4 px-4 py-2.5">
            <span className="text-xs font-semibold text-[var(--text-faint)] pt-0.5 truncate">
              {humanizeKey(key)}
            </span>
            <span className="text-sm text-[var(--text-high)] break-words">
              {formatValue(val)}
            </span>
          </div>
        ))}
        {nested.map(([key, val]) => (
          <div key={key} className="px-4 py-2.5">
            <div className="text-xs font-semibold text-[var(--text-faint)] mb-1.5 uppercase tracking-wide">
              {humanizeKey(key)}
            </div>
            <div className="pl-3 border-l-2 border-[var(--border-dim)] space-y-1">
              {Object.entries(val as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[160px_1fr] gap-3">
                  <span className="text-xs text-[var(--text-faint)]">{humanizeKey(k)}</span>
                  <span className="text-xs text-[var(--text-high)]">{formatValue(v)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {entries.length === 0 && nested.length === 0 && (
          <div className="px-4 py-4 text-sm text-[var(--text-faint)] text-center">
            Sem dados no snapshot
          </div>
        )}
      </div>
    </div>
  );
}
