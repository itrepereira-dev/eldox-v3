// frontend-web/src/modules/fvm/dashboard/components/AprovacaoCategoriaChart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts';
import type { FvmDashboardCategoria } from '@/services/fvm.service';

interface Props {
  data: FvmDashboardCategoria[];
}

function getBarColor(taxa: number): string {
  if (taxa >= 80) return 'var(--ok-text)';
  if (taxa >= 60) return '#EAB308'; // yellow-500
  return 'var(--nc-text)';
}

export function AprovacaoCategoriaChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[var(--text-faint)]">
        Sem dados de categorias no período.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3">
        Aprovação por Categoria de Material
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="categoria_nome"
            width={110}
            tick={{ fontSize: 12, fill: 'var(--text-high)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Taxa de aprovação']}
            contentStyle={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-dim)',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Bar dataKey="taxa_aprovacao" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.taxa_aprovacao)} />
            ))}
            <LabelList
              dataKey="total_lotes"
              position="right"
              formatter={(v) => `${v} lotes`}
              style={{ fontSize: 11, fill: 'var(--text-faint)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
