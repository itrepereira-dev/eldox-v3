// frontend-web/src/modules/concretagem/concretagens/components/CurvaResistenciaChart.tsx
import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/cn';
import { CaminhaoDrawer } from './CaminhaoDrawer';

interface CpItem {
  id: number;
  numero: string;
  caminhao_id: number;
  caminhao_numero?: string;
  caminhao_nf?: string;
  idade_dias: number;
  resistencia: number | null;
  data_ruptura_prev: string | null;
  data_ruptura_real: string | null;
  status: 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';
}

interface CaminhaoInfo {
  id: number;
  numero: string;
  numero_nf: string | null;
  volume: number | null;
  hora_chegada: string | null;
  cps: CpItem[];
}

interface CurvaResistenciaChartProps {
  cps: CpItem[];
  caminhoes: CaminhaoInfo[];
  fck: number;
}

const PALETTE = ['#6366f1', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8'];
const IDADES = [3, 7, 28];

export function CurvaResistenciaChart({ cps, caminhoes, fck }: CurvaResistenciaChartProps) {
  const [selectedCaminhoes, setSelectedCaminhoes] = useState<Set<number>>(new Set());
  const [drawerCaminhao, setDrawerCaminhao] = useState<CaminhaoInfo | null>(null);

  // Agrupar CPs por caminhão
  const byCaminhao = new Map<number, CpItem[]>();
  for (const cp of cps) {
    if (!byCaminhao.has(cp.caminhao_id)) byCaminhao.set(cp.caminhao_id, []);
    byCaminhao.get(cp.caminhao_id)!.push(cp);
  }

  // Dados por idade (eixo X)
  const chartData = IDADES.map((idade) => {
    const point: Record<string, number | null | string> = { idade: idade.toString() };
    for (const cam of caminhoes) {
      const cpAtIdade = (byCaminhao.get(cam.id) ?? []).find((c) => c.idade_dias === idade);
      point[`cam_${cam.id}`] = cpAtIdade?.resistencia ?? null;
    }
    return point;
  });

  const toggleCaminhao = (camId: number) => {
    setSelectedCaminhoes((prev) => {
      const next = new Set(prev);
      if (next.has(camId)) {
        next.delete(camId);
      } else {
        next.add(camId);
      }
      return next;
    });
  };

  const isVisible = (camId: number) =>
    selectedCaminhoes.size === 0 || selectedCaminhoes.has(camId);

  if (caminhoes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-faint)] text-center py-8">
        Nenhum caminhão com dados de resistência.
      </p>
    );
  }

  return (
    <div>
      {/* Legenda interativa */}
      <div className="flex flex-wrap gap-2 mb-4">
        {caminhoes.map((cam, i) => {
          const color = PALETTE[i % PALETTE.length];
          const active = isVisible(cam.id);
          return (
            <button
              key={cam.id}
              type="button"
              onClick={() => toggleCaminhao(cam.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity',
                active ? 'opacity-100' : 'opacity-30',
              )}
              style={{ borderColor: color, color }}
            >
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
              {cam.numero}
            </button>
          );
        })}
        {selectedCaminhoes.size > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCaminhoes(new Set())}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text-med)] px-2"
          >
            Mostrar todos
          </button>
        )}
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" />
          <XAxis
            dataKey="idade"
            tickFormatter={(v) => `${v}d`}
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
          />
          <YAxis
            unit=" MPa"
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)', borderRadius: 8 }}
            labelFormatter={(l) => `${l} dias`}
            formatter={(value: number | null, name: string) => {
              const cam = caminhoes.find((c) => `cam_${c.id}` === name);
              return [value != null ? `${value} MPa` : '—', cam?.numero ?? name];
            }}
          />
          <ReferenceLine
            y={fck}
            stroke="#ef4444"
            strokeDasharray="6 4"
            label={{ value: `fck ${fck}`, fill: '#ef4444', fontSize: 10, position: 'right' }}
          />
          {caminhoes.map((cam, i) => (
            <Line
              key={cam.id}
              dataKey={`cam_${cam.id}`}
              name={`cam_${cam.id}`}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={isVisible(cam.id) ? 2 : 1}
              opacity={isVisible(cam.id) ? 1 : 0.15}
              dot={{ r: 4, fill: PALETTE[i % PALETTE.length], cursor: 'pointer' }}
              activeDot={(props: Record<string, unknown>) => (
                <circle
                  {...(props as React.SVGProps<SVGCircleElement>)}
                  r={6}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDrawerCaminhao(cam)}
                />
              )}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Drawer de detalhes do caminhão */}
      {drawerCaminhao && (
        <CaminhaoDrawer
          caminhao={{
            ...drawerCaminhao,
            cps: (byCaminhao.get(drawerCaminhao.id) ?? []).map((cp) => ({
              ...cp,
              caminhao_numero: drawerCaminhao.numero,
            })),
          }}
          fck={fck}
          onClose={() => setDrawerCaminhao(null)}
        />
      )}
    </div>
  );
}
