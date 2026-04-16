// frontend-web/src/modules/concretagem/croqui/components/CroquiSvg.tsx
// Grade SVG interativa do croqui de rastreabilidade — SPEC 7

import type { ElementoCroqui, ElementosPayload } from '@/services/concretagem.service';

// ─── Constantes de Layout ─────────────────────────────────────────────────────

const CELL = 72;          // largura/altura base por célula (px)
const HEADER = 32;        // largura do header de linha/coluna
const PAD = 12;           // padding externo

// ─── Cores por tipo ───────────────────────────────────────────────────────────

const TIPO_COLORS: Record<ElementoCroqui['tipo'], { fill: string; stroke: string; text: string }> = {
  painel_laje: { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e40af' },
  pilar:       { fill: '#fef9c3', stroke: '#eab308', text: '#713f12' },
  viga:        { fill: '#fce7f3', stroke: '#ec4899', text: '#831843' },
  outro:       { fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569' },
};

const TIPO_LABELS: Record<ElementoCroqui['tipo'], string> = {
  painel_laje: 'Laje',
  pilar: 'Pilar',
  viga: 'Viga',
  outro: 'Outro',
};

// ─── Paleta de caminhões (10 cores distintas) ─────────────────────────────────

const CAMINHAO_PALETTE: Array<{ fill: string; stroke: string; text: string }> = [
  { fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' }, // azul
  { fill: '#dcfce7', stroke: '#16a34a', text: '#14532d' }, // verde
  { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' }, // amarelo
  { fill: '#fce7f3', stroke: '#db2777', text: '#831843' }, // rosa
  { fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' }, // roxo
  { fill: '#ffedd5', stroke: '#ea580c', text: '#7c2d12' }, // laranja
  { fill: '#e0f2fe', stroke: '#0284c7', text: '#0c4a6e' }, // azul-claro
  { fill: '#f0fdf4', stroke: '#15803d', text: '#052e16' }, // verde-escuro
  { fill: '#fdf4ff', stroke: '#a21caf', text: '#581c87' }, // fúcsia
  { fill: '#fff7ed', stroke: '#c2410c', text: '#431407' }, // laranja-escuro
];

export interface ElementoColorOverride {
  fill: string;
  stroke: string;
  text: string;
  nf?: string;         // número da NF do caminhão
  sequencia?: number;  // sequência do caminhão
}

/**
 * Gera mapeamento de elemento_id → color override com base nos caminhões.
 * Usa elemento_lancado do caminhão para encontrar o elemento correspondente pelo label.
 */
export function buildCaminhaoColorMap(
  caminhoes: Array<{ id: number; sequencia: number; numero_nf: string; elemento_lancado?: string | null; status: string }>,
  elementos: ElementosPayload,
): Record<string, ElementoColorOverride> {
  const map: Record<string, ElementoColorOverride> = {};
  // Só considera caminhões que lançaram (CONCLUIDO ou EM_LANCAMENTO)
  const ativos = caminhoes.filter((c) => c.status === 'CONCLUIDO' || c.status === 'EM_LANCAMENTO');
  for (const cam of ativos) {
    if (!cam.elemento_lancado) continue;
    const targetLabel = cam.elemento_lancado.trim().toLowerCase();
    const elem = elementos.elementos.find(
      (el) => el.label.trim().toLowerCase() === targetLabel,
    );
    if (!elem) continue;
    const palette = CAMINHAO_PALETTE[(cam.sequencia - 1) % CAMINHAO_PALETTE.length];
    map[elem.id] = {
      ...palette,
      nf: cam.numero_nf,
      sequencia: cam.sequencia,
    };
  }
  return map;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CroquiSvgProps {
  elementos: ElementosPayload;
  selecionado?: string | null;
  onSelect?: (id: string) => void;
  readonly?: boolean;
  className?: string;
  /** Override de cor por elemento_id (para coloração por caminhão) */
  elementoColors?: Record<string, ElementoColorOverride>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CroquiSvg({
  elementos,
  selecionado,
  onSelect,
  readonly = false,
  className,
  elementoColors,
}: CroquiSvgProps) {
  const { eixos_x, eixos_y, elementos: elems } = elementos;

  const cols = eixos_x.length || 1;
  const rows = eixos_y.length || 1;

  const svgW = PAD * 2 + HEADER + cols * CELL;
  const svgH = PAD * 2 + HEADER + rows * CELL;

  // Mapeia elementos por posição para renderização
  const cellX = (col: number) => PAD + HEADER + col * CELL;
  const cellY = (row: number) => PAD + HEADER + row * CELL;

  return (
    <div className={className ?? ''} style={{ overflowX: 'auto' }}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ fontFamily: 'inherit', userSelect: 'none' }}
        aria-label="Croqui de rastreabilidade"
      >
        {/* ── Fundo ────────────────────────────────────────────────────── */}
        <rect x={0} y={0} width={svgW} height={svgH} fill="var(--bg-base, #f8fafc)" />

        {/* ── Grade de referência (células vazias) ─────────────────────── */}
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => (
            <rect
              key={`grid-${r}-${c}`}
              x={cellX(c)}
              y={cellY(r)}
              width={CELL}
              height={CELL}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
          )),
        )}

        {/* ── Header colunas (eixos_x: A, B, C…) ──────────────────────── */}
        {eixos_x.map((eixo, i) => (
          <text
            key={`hx-${i}`}
            x={cellX(i) + CELL / 2}
            y={PAD + HEADER / 2 + 5}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill="#64748b"
          >
            {eixo}
          </text>
        ))}

        {/* ── Header linhas (eixos_y: 1, 2, 3…) ───────────────────────── */}
        {eixos_y.map((eixo, i) => (
          <text
            key={`hy-${i}`}
            x={PAD + HEADER / 2}
            y={cellY(i) + CELL / 2 + 5}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill="#64748b"
          >
            {eixo}
          </text>
        ))}

        {/* ── Elementos estruturais ─────────────────────────────────────── */}
        {elems.map((el) => {
          const colorOverride = elementoColors?.[el.id];
          const colors = colorOverride ?? TIPO_COLORS[el.tipo] ?? TIPO_COLORS.outro;
          const x = cellX(el.col);
          const y = cellY(el.row);
          const w = el.colspan * CELL;
          const h = el.rowspan * CELL;
          const isSelected = selecionado === el.id;

          return (
            <g
              key={el.id}
              onClick={() => !readonly && onSelect?.(el.id)}
              style={{ cursor: readonly ? 'default' : 'pointer' }}
              aria-label={`${TIPO_LABELS[el.tipo]} ${el.label}`}
            >
              <rect
                x={x + 2}
                y={y + 2}
                width={w - 4}
                height={h - 4}
                rx={6}
                fill={colors.fill}
                stroke={isSelected ? '#6366f1' : colors.stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
                opacity={0.95}
              />

              {/* Label principal */}
              <text
                x={x + w / 2}
                y={y + h / 2 - (h > CELL ? 8 : colorOverride ? 4 : 4)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={h > CELL ? 14 : 11}
                fontWeight={700}
                fill={colors.text}
              >
                {el.label}
              </text>

              {/* Caminhão badge (NF) quando colorido por caminhão */}
              {colorOverride?.nf && (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fill={colors.stroke}
                  fontWeight={600}
                >
                  #{colorOverride.sequencia} · {colorOverride.nf}
                </text>
              )}

              {/* Subtipo (só se o elemento tiver espaço e não for override) */}
              {h > CELL && !colorOverride && (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill={colors.text}
                  opacity={0.7}
                >
                  {TIPO_LABELS[el.tipo].toUpperCase()}
                </text>
              )}

              {/* Seleção: anel highlight */}
              {isSelected && (
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={w - 4}
                  height={h - 4}
                  rx={6}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={3}
                  strokeDasharray="6 3"
                  opacity={0.6}
                />
              )}
            </g>
          );
        })}

        {/* ── Estado vazio ─────────────────────────────────────────────── */}
        {elems.length === 0 && (
          <text
            x={svgW / 2}
            y={svgH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={13}
            fill="#94a3b8"
          >
            Nenhum elemento definido
          </text>
        )}
      </svg>

      {/* Legenda */}
      {elementoColors && Object.keys(elementoColors).length > 0 ? (
        // Legenda de caminhões (modo rastreabilidade)
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Caminhões Lançados
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
            {Array.from(
              new Map(
                Object.values(elementoColors)
                  .filter((c) => c.sequencia != null)
                  .map((c) => [c.sequencia, c]),
              ).values(),
            )
              .sort((a, b) => (a.sequencia ?? 0) - (b.sequencia ?? 0))
              .map((c) => (
                <span key={c.sequencia} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#475569' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: c.fill, border: `1.5px solid ${c.stroke}`, display: 'inline-block' }} />
                  #{c.sequencia} NF {c.nf}
                </span>
              ))}
          </div>
        </div>
      ) : (
        // Legenda por tipo (modo padrão)
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: '#64748b' }}>
          {(Object.entries(TIPO_COLORS) as [ElementoCroqui['tipo'], typeof TIPO_COLORS.pilar][]).map(
            ([tipo, c]) => (
              <span key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: c.fill,
                    border: `1.5px solid ${c.stroke}`,
                    display: 'inline-block',
                  }}
                />
                {TIPO_LABELS[tipo]}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}
