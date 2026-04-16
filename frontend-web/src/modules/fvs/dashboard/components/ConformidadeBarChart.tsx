// frontend-web/src/modules/fvs/dashboard/components/ConformidadeBarChart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  type TooltipProps,
} from 'recharts';
import type { ConformidadePorServicoItem, Tendencia } from '../../../../services/fvs.service';

// ── Colour helpers ────────────────────────────────────────────────────────────

function taxaColor(t: number): string {
  if (t >= 85) return 'var(--ok)';
  if (t >= 70) return '#f0ad4e';
  return 'var(--nc)';
}

function tendenciaIcon(t: Tendencia): string {
  if (t === 'subindo') return '↑';
  if (t === 'caindo') return '↓';
  return '→';
}

function tendenciaColor(t: Tendencia): string {
  if (t === 'subindo') return 'var(--ok)';
  if (t === 'caindo') return 'var(--nc)';
  return 'var(--text-low)';
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as ConformidadePorServicoItem;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-[var(--text-high)]">{d.servico_nome}</p>
      <p>
        <span className="text-[var(--text-low)]">Conformidade: </span>
        <span className="font-bold" style={{ color: taxaColor(d.taxa_conformidade) }}>
          {d.taxa_conformidade}%
        </span>
      </p>
      <p>
        <span className="text-[var(--text-low)]">Inspeções: </span>
        <span className="text-[var(--text-high)]">{d.total_inspecoes}</span>
      </p>
      <p>
        <span className="text-[var(--text-low)]">NCs abertas: </span>
        <span style={{ color: d.ncs_abertas > 0 ? 'var(--nc)' : 'var(--ok)' }}>{d.ncs_abertas}</span>
      </p>
      <p>
        <span className="text-[var(--text-low)]">Tendência: </span>
        <span style={{ color: tendenciaColor(d.tendencia) }}>
          {tendenciaIcon(d.tendencia)} {d.tendencia}
        </span>
      </p>
    </div>
  );
}

// ── Custom label inside bar ───────────────────────────────────────────────────

function BarLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props;
  if (width < 40) return null; // not enough room
  return (
    <text
      x={x + width - 6}
      y={y + height / 2 + 1}
      textAnchor="end"
      dominantBaseline="middle"
      fontSize={11}
      fill="white"
      fontWeight="bold"
    >
      {value}%
    </text>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: ConformidadePorServicoItem[];
}

export function ConformidadeBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--text-low)] text-sm gap-2">
        <span>Nenhum serviço com inspeções no período</span>
        <span className="text-xs">Tente ampliar o filtro de datas</span>
      </div>
    );
  }

  // Already sorted by taxa ASC from backend (worst first)
  const chartData = data.map((d) => ({
    ...d,
    taxa_conformidade: Number(d.taxa_conformidade),
  }));

  const barHeight = 36;
  const chartHeight = Math.max(160, chartData.length * barHeight + 24);

  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--text-low)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            type="category"
            dataKey="servico_nome"
            width={140}
            tick={{ fontSize: 11, fill: 'var(--text-high)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--off-bg)' }} />
          <Bar dataKey="taxa_conformidade" radius={[0, 4, 4, 0]} label={<BarLabel />}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={taxaColor(entry.taxa_conformidade)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Tendency badges overlaid to the right */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: barHeight - 14,
          paddingTop: 4,
          pointerEvents: 'none',
        }}
      >
        {chartData.map((d) => (
          <span
            key={d.servico_id}
            style={{ color: tendenciaColor(d.tendencia), fontSize: 14, fontWeight: 700, lineHeight: 1 }}
            title={d.tendencia}
          >
            {tendenciaIcon(d.tendencia)}
          </span>
        ))}
      </div>
    </div>
  );
}
