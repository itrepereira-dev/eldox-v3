// frontend-web/src/modules/fvs/dashboard/components/FiltrosPeriodo.tsx
import { useSearchParams } from 'react-router-dom';
import { type GraficosFiltros, type Granularidade } from '../../../../services/fvs.service';

// ── Preset helpers ────────────────────────────────────────────────────────────

type Preset = '4s' | '3m' | '6m' | 'custom';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetToRange(preset: Preset): { data_inicio: string; data_fim: string } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = isoDate(hoje);

  if (preset === '4s') {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 28);
    return { data_inicio: isoDate(inicio), data_fim: fim };
  }
  if (preset === '3m') {
    const inicio = new Date(hoje);
    inicio.setMonth(inicio.getMonth() - 3);
    return { data_inicio: isoDate(inicio), data_fim: fim };
  }
  if (preset === '6m') {
    const inicio = new Date(hoje);
    inicio.setMonth(inicio.getMonth() - 6);
    return { data_inicio: isoDate(inicio), data_fim: fim };
  }
  // 'custom' falls through — caller keeps existing values
  return { data_inicio: fim, data_fim: fim };
}

// ── Default filtros (4 semanas, granularidade semana) ─────────────────────────

export function defaultFiltros(): GraficosFiltros {
  const { data_inicio, data_fim } = presetToRange('4s');
  return { data_inicio, data_fim, granularidade: 'semana' };
}

// ── Hook: read / write filtros from URL params ────────────────────────────────

export function useFiltrosPeriodo(): [GraficosFiltros, (f: GraficosFiltros) => void] {
  const [params, setParams] = useSearchParams();

  const defaults = defaultFiltros();
  const filtros: GraficosFiltros = {
    data_inicio: params.get('gi') ?? defaults.data_inicio,
    data_fim: params.get('gf') ?? defaults.data_fim,
    granularidade: (params.get('gg') as Granularidade) ?? defaults.granularidade,
    servico_ids: params.getAll('gs').map(Number).filter((n) => !isNaN(n) && n > 0),
  };

  function setFiltros(f: GraficosFiltros) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('gi', f.data_inicio);
        next.set('gf', f.data_fim);
        next.set('gg', f.granularidade);
        next.delete('gs');
        (f.servico_ids ?? []).forEach((id) => next.append('gs', String(id)));
        return next;
      },
      { replace: true },
    );
  }

  return [filtros, setFiltros];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value: GraficosFiltros;
  onChange: (f: GraficosFiltros) => void;
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Últ. 4 semanas', value: '4s' },
  { label: 'Últ. 3 meses', value: '3m' },
  { label: 'Últ. 6 meses', value: '6m' },
  { label: 'Personalizado', value: 'custom' },
];

export function FiltrosPeriodo({ value, onChange }: Props) {
  function detectPreset(): Preset {
    const hoje = isoDate(new Date());
    const r4s = presetToRange('4s');
    const r3m = presetToRange('3m');
    const r6m = presetToRange('6m');
    if (value.data_inicio === r4s.data_inicio && value.data_fim === hoje) return '4s';
    if (value.data_inicio === r3m.data_inicio && value.data_fim === hoje) return '3m';
    if (value.data_inicio === r6m.data_inicio && value.data_fim === hoje) return '6m';
    return 'custom';
  }

  const activePreset = detectPreset();

  function handlePreset(p: Preset) {
    if (p === 'custom') return; // stay in custom mode, allow date inputs
    const range = presetToRange(p);
    onChange({ ...value, ...range });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              activePreset === p.value
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--off-bg)] text-[var(--text-low)] hover:bg-[var(--border)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs — always visible in custom mode */}
      {activePreset === 'custom' && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={value.data_inicio}
            onChange={(e) => onChange({ ...value, data_inicio: e.target.value })}
            className="border border-[var(--border)] rounded px-2 py-0.5 text-xs bg-[var(--bg-card)] text-[var(--text-high)]"
          />
          <span className="text-xs text-[var(--text-low)]">→</span>
          <input
            type="date"
            value={value.data_fim}
            onChange={(e) => onChange({ ...value, data_fim: e.target.value })}
            className="border border-[var(--border)] rounded px-2 py-0.5 text-xs bg-[var(--bg-card)] text-[var(--text-high)]"
          />
        </div>
      )}

      {/* Granularity toggle */}
      <div className="flex gap-1 border border-[var(--border)] rounded overflow-hidden">
        {(['semana', 'mes'] as Granularidade[]).map((g) => (
          <button
            key={g}
            onClick={() => onChange({ ...value, granularidade: g })}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              value.granularidade === g
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-low)] hover:bg-[var(--off-bg)]'
            }`}
          >
            {g === 'semana' ? 'Semana' : 'Mês'}
          </button>
        ))}
      </div>
    </div>
  );
}
