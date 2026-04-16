// frontend-web/src/modules/fvs/dashboard/components/FunilInspecoes.tsx
import { useState } from 'react';
import type { FunilData } from '../../../../services/fvs.service';

// ── Stage definitions ─────────────────────────────────────────────────────────

interface Stage {
  key: keyof FunilData;
  label: string;
  fill: string;
  description: string;
}

const STAGES: Stage[] = [
  {
    key: 'total_fichas',
    label: 'Total de Fichas',
    fill: '#6366f1',
    description: 'Todas as fichas de inspeção criadas no período',
  },
  {
    key: 'concluidas',
    label: 'Concluídas',
    fill: '#3b82f6',
    description: 'Fichas onde todos os itens foram avaliados',
  },
  {
    key: 'aprovadas',
    label: 'Aprovadas',
    fill: '#10b981',
    description: 'Fichas com status final "aprovada"',
  },
  {
    key: 'com_nc',
    label: 'Com NC',
    fill: '#f59e0b',
    description: 'Fichas que geraram pelo menos uma Não Conformidade',
  },
  {
    key: 'com_pa',
    label: 'Com PA',
    fill: '#ef4444',
    description: 'Fichas que geraram Plano de Ação (PA)',
  },
];

// ── SVG trapezoid path ────────────────────────────────────────────────────────
// Draws a trapezoid: wider at top (topW), narrower at bottom (botW), height h
// centered at cx
function trapezoidPath(cx: number, y: number, topW: number, botW: number, h: number): string {
  const topLeft = cx - topW / 2;
  const topRight = cx + topW / 2;
  const botLeft = cx - botW / 2;
  const botRight = cx + botW / 2;
  return `M ${topLeft} ${y} L ${topRight} ${y} L ${botRight} ${y + h} L ${botLeft} ${y + h} Z`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: FunilData;
}

export function FunilInspecoes({ data }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.total_fichas;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--text-low)] text-sm gap-2">
        <span>Nenhuma ficha no período selecionado</span>
        <span className="text-xs">Tente ampliar o filtro de datas</span>
      </div>
    );
  }

  // SVG dimensions
  const svgWidth = 340;
  const svgHeight = 260;
  const cx = svgWidth / 2;
  const stageH = 42; // height of each trapezoid
  const gap = 3;     // gap between stages
  const maxW = 220;  // width at 100%
  const minW = 28;   // minimum width for any stage (avoids invisible shapes)

  function stageValue(key: keyof FunilData): number {
    return data[key] as number;
  }

  function widthForStage(idx: number): number {
    const val = stageValue(STAGES[idx].key);
    // First stage is always maxW; subsequent are proportional but at least minW
    if (total === 0) return minW;
    const ratio = val / total;
    return Math.max(minW, maxW * ratio);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {STAGES.map((stage, idx) => {
          const topW = widthForStage(idx);
          // Next stage width (for bottom edge) or same as top for last
          const botW = idx < STAGES.length - 1 ? widthForStage(idx + 1) : topW;
          const y = idx * (stageH + gap);
          const val = stageValue(stage.key);
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={stage.key}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'default' }}
            >
              <path
                d={trapezoidPath(cx, y, topW, botW, stageH)}
                fill={stage.fill}
                opacity={isHovered ? 1 : 0.82}
              />
              {/* Value label — left side */}
              <text
                x={cx - maxW / 2 - 8}
                y={y + stageH / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={12}
                fontWeight="600"
                fill="var(--text-high)"
              >
                {val.toLocaleString('pt-BR')}
              </text>
              {/* Percentage label — right side */}
              <text
                x={cx + maxW / 2 + 8}
                y={y + stageH / 2 + 1}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--text-low)"
              >
                {pct}%
              </text>
              {/* Stage name inside the bar if wide enough */}
              {topW > 70 && (
                <text
                  x={cx}
                  y={y + stageH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight="600"
                  fill="white"
                >
                  {stage.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip / description for hovered stage */}
      <div
        className="text-xs text-[var(--text-low)] text-center px-4 transition-opacity"
        style={{ minHeight: 18, opacity: hoveredIdx !== null ? 1 : 0 }}
      >
        {hoveredIdx !== null ? STAGES[hoveredIdx].description : ''}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {STAGES.map((stage) => {
          const val = stageValue(stage.key);
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={stage.key} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: stage.fill }} />
              <span className="text-[var(--text-low)]">{stage.label}:</span>
              <span className="font-semibold text-[var(--text-high)]">{val}</span>
              <span className="text-[var(--text-low)]">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
