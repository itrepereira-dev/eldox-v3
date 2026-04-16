// frontend-web/src/modules/fvs/dashboard/components/EvolucaoTemporalChart.tsx
import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { EvolucaoTemporalData } from '../../../../services/fvs.service';

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; color: string; name: string; value: number | null }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-lg text-xs">
      <p className="font-semibold text-[var(--text-high)] mb-2">{label}</p>
      {payload.map((entry: { dataKey: string; color: string; name: string; value: number | null }) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-[var(--text-low)]">{entry.name}:</span>
          <span className="font-bold text-[var(--text-high)]">
            {entry.value !== null && entry.value !== undefined ? `${entry.value}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: EvolucaoTemporalData;
  targetPct?: number; // default 85
}

export function EvolucaoTemporalChart({ data, targetPct = 85 }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (data.labels.length === 0 || data.series.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--text-low)] text-sm gap-2">
        <span>Nenhuma inspeção no período selecionado</span>
        <span className="text-xs">Tente ampliar o filtro de datas</span>
      </div>
    );
  }

  // Build recharts data: [{ label: "Sem 1", "Alvenaria": 88.2, "Concreto": null, ... }]
  const chartData = data.labels.map((label, i) => {
    const point: Record<string, string | number | null> = { label };
    for (const s of data.series) {
      point[s.servico_nome] = s.valores[i] ?? null;
    }
    return point;
  });

  function toggleSeries(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-low)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--text-low)' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            onClick={(e) => toggleSeries(e.value as string)}
            formatter={(value) => (
              <span
                style={{
                  color: hidden.has(value) ? 'var(--text-low)' : 'var(--text-high)',
                  textDecoration: hidden.has(value) ? 'line-through' : 'none',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {value}
              </span>
            )}
          />
          {/* Target reference line */}
          <ReferenceLine
            y={targetPct}
            stroke="var(--warn)"
            strokeDasharray="6 3"
            label={{
              value: `Meta ${targetPct}%`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: 'var(--warn)',
            }}
          />
          {data.series.map((s) => (
            <Line
              key={s.servico_id}
              type="monotone"
              dataKey={s.servico_nome}
              stroke={s.cor}
              strokeWidth={2}
              dot={{ r: 3, fill: s.cor }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              hide={hidden.has(s.servico_nome)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
