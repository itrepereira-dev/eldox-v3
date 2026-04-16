// frontend-web/src/modules/fvm/dashboard/components/EvolucaoLotesChart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { FvmDashboardSemana } from '@/services/fvm.service';

interface Props {
  data: FvmDashboardSemana[];
}

export function EvolucaoLotesChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[var(--text-faint)]">
        Sem lotes recebidos no período.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3">
        Evolução de Lotes por Semana
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="semana"
            tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-dim)',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="aprovados"  name="Aprovados"   stackId="a" fill="var(--ok-text)"  />
          <Bar dataKey="quarentena" name="Quarentena"  stackId="a" fill="#F97316"         />
          <Bar dataKey="reprovados" name="Reprovados"  stackId="a" fill="var(--nc-text)"  />
          <Bar dataKey="aguardando" name="Aguardando"  stackId="a" fill="var(--border-dim)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
