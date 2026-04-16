// frontend-web/src/modules/fvs/dashboard/components/HeatmapServicos.tsx
import { Fragment, useState } from 'react';
import type { HeatmapData } from '../../../../services/fvs.service';

// ── Colour by taxa ────────────────────────────────────────────────────────────

function cellStyle(taxa: number | null): React.CSSProperties {
  if (taxa === null) {
    return {
      background: 'var(--bg-raised, #f3f4f6)',
      color: 'var(--text-low)',
    };
  }
  if (taxa < 60) {
    return {
      background: 'var(--nc-bg, #fee2e2)',
      color: 'var(--nc-text, #b91c1c)',
    };
  }
  if (taxa < 80) {
    return {
      background: 'var(--warn-bg, #fef9c3)',
      color: 'var(--warn-text, #854d0e)',
    };
  }
  if (taxa < 90) {
    return {
      background: '#dcfce7',
      color: '#166534',
    };
  }
  return {
    background: 'var(--ok-bg, #bbf7d0)',
    color: 'var(--ok-text, #14532d)',
  };
}

// ── Tooltip state ─────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: HeatmapData;
}

export function HeatmapServicos({ data }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (data.servicos.length === 0 || data.periodos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--text-low)] text-sm gap-2">
        <span>Nenhuma inspeção no período selecionado</span>
        <span className="text-xs">Tente ampliar o filtro de datas</span>
      </div>
    );
  }

  // Build lookup: [servico_idx][periodo_idx] → celula
  const lookup = new Map<string, { taxa: number | null; total_inspecoes: number }>();
  for (const c of data.celulas) {
    lookup.set(`${c.servico_idx}-${c.periodo_idx}`, { taxa: c.taxa, total_inspecoes: c.total_inspecoes });
  }

  const cellSize = data.periodos.length > 12 ? 32 : 40;
  const leftColWidth = 148;

  // grid-template-columns: [left col] + [N period cols]
  const gridTemplateColumns = `${leftColWidth}px repeat(${data.periodos.length}, ${cellSize}px)`;

  function handleMouseEnter(e: React.MouseEvent, sNome: string, pLabel: string, taxa: number | null, total: number) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const text =
      taxa !== null
        ? `${sNome} — ${pLabel}: ${taxa}% (${total} inspeções)`
        : `${sNome} — ${pLabel}: sem inspeção`;
    setTooltip({ x: rect.left + window.scrollX, y: rect.top + window.scrollY - 32, text });
  }

  return (
    <div className="relative">
      {/* Scrollable container */}
      <div className="overflow-x-auto">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns,
            width: 'max-content',
          }}
        >
          {/* Header row */}
          {/* Top-left corner cell */}
          <div
            style={{
              position: 'sticky',
              left: 0,
              zIndex: 20,
              background: 'var(--bg-card)',
              width: leftColWidth,
              height: cellSize,
              borderBottom: '1px solid var(--border)',
            }}
          />
          {data.periodos.map((periodo, pi) => (
            <div
              key={`h-${pi}`}
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--bg-card)',
                width: cellSize,
                height: cellSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'var(--text-low)',
                fontWeight: 600,
                borderBottom: '1px solid var(--border)',
                borderLeft: '1px solid var(--border)',
                padding: '0 2px',
                textAlign: 'center',
              }}
            >
              {periodo}
            </div>
          ))}

          {/* Data rows */}
          {data.servicos.map((servico, si) => (
            <Fragment key={`row-${si}`}>
              {/* Sticky left: service name */}
              <div
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  background: 'var(--bg-card)',
                  width: leftColWidth,
                  height: cellSize,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                  fontSize: 11,
                  color: 'var(--text-high)',
                  fontWeight: 500,
                  borderTop: si > 0 ? '1px solid var(--border)' : undefined,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
                title={servico}
              >
                {servico}
              </div>

              {/* Data cells */}
              {data.periodos.map((periodo, pi) => {
                const cell = lookup.get(`${si}-${pi}`);
                const taxa = cell?.taxa ?? null;
                const total = cell?.total_inspecoes ?? 0;
                return (
                  <div
                    key={`c-${si}-${pi}`}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'default',
                      borderTop: si > 0 ? '1px solid var(--border)' : undefined,
                      borderLeft: '1px solid var(--border)',
                      transition: 'filter 0.1s',
                      ...cellStyle(taxa),
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, servico, periodo, taxa, total)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {taxa !== null ? `${taxa}` : '–'}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 50,
            pointerEvents: 'none',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            color: 'var(--text-high)',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
