// frontend-web/src/modules/fvs/inspecao/components/GradeCroquiView.tsx
//
// Visualização da grade em formato croqui: cada torre é um bloco, com
// pavimentos empilhados (mais alto no topo) e unidades lado a lado. A cor
// da célula reflete o pior status entre todos os serviços visíveis.
import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { FvsGrade, StatusGrade } from '../../../../services/fvs.service';

// Ordem de criticidade — do pior para o melhor. O que importa pro gestor é
// ver onde há NC antes de ver o que está aprovado.
const STATUS_PRIORIDADE: StatusGrade[] = [
  'nc_final',
  'nc',
  'pendente',
  'parcial',
  'nao_avaliado',
  'liberado',
  'aprovado',
];

function piorStatus(statuses: StatusGrade[]): StatusGrade {
  for (const s of STATUS_PRIORIDADE) {
    if (statuses.includes(s)) return s;
  }
  return 'nao_avaliado';
}

const CELL_CLS: Record<StatusGrade, string> = {
  nc:           'bg-[var(--nc-text)] text-white border-[var(--nc-text)]',
  nc_final:     'bg-red-900 text-white border-red-900',
  aprovado:     'bg-[var(--ok-text)] text-white border-[var(--ok-text)]',
  liberado:     'bg-yellow-400 text-yellow-900 border-yellow-500',
  pendente:     'bg-[var(--warn-text)] text-white border-[var(--warn-text)]',
  parcial:      'bg-blue-300 text-blue-900 border-blue-400',
  nao_avaliado: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border-[var(--border-dim)]',
};

interface LocalGrade {
  id: number;
  nome: string;
  pavimento_id: number | null;
  pavimento_nome: string | null;
}

interface TorreBloco {
  chave: string;            // ex: "Condomínio 1 > Torre A"
  label: string;            // última parte, ex: "Torre A"
  contexto: string | null;  // antes da última, ex: "Condomínio 1"
  pavimentos: {
    id: number;
    label: string;          // ex: "1º Pavimento"
    ordem: number;          // para ordenar DESC
    locais: LocalGrade[];
  }[];
}

function parsePavimentoPath(path: string | null): { torreChave: string; pavLabel: string } {
  if (!path) return { torreChave: '—', pavLabel: '—' };
  const partes = path.split(' > ');
  const pavLabel = partes[partes.length - 1] ?? path;
  const torreChave = partes.slice(0, -1).join(' > ') || '—';
  return { torreChave, pavLabel };
}

// Extrai um número da label do pavimento (1º, 2º…) pra ordenar DESC. Cai pra 0
// se não conseguir — mantém ordem de criação.
function numeroPavimento(label: string): number {
  const m = label.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export function GradeCroquiView({
  grade,
  servicosVisiveis,
  onClickCelula,
  readOnly,
}: {
  grade: FvsGrade;
  servicosVisiveis: { id: number; nome: string }[];
  onClickCelula?: (local: LocalGrade, servicoId: number | null) => void;
  readOnly?: boolean;
}) {
  // Agrupa locais em Torre → Pavimento
  const torres = useMemo<TorreBloco[]>(() => {
    const mapa = new Map<string, TorreBloco>();

    for (const loc of grade.locais as LocalGrade[]) {
      const { torreChave, pavLabel } = parsePavimentoPath(loc.pavimento_nome);
      let torre = mapa.get(torreChave);
      if (!torre) {
        const partes = torreChave.split(' > ');
        torre = {
          chave: torreChave,
          label: partes[partes.length - 1] ?? torreChave,
          contexto: partes.length > 1 ? partes.slice(0, -1).join(' › ') : null,
          pavimentos: [],
        };
        mapa.set(torreChave, torre);
      }

      let pav = torre.pavimentos.find(p => p.id === loc.pavimento_id);
      if (!pav) {
        pav = {
          id: loc.pavimento_id ?? -1,
          label: pavLabel,
          ordem: numeroPavimento(pavLabel),
          locais: [],
        };
        torre.pavimentos.push(pav);
      }
      pav.locais.push(loc);
    }

    // Ordena pavimentos DESC (mais alto no topo) e torres pelo chave
    for (const torre of mapa.values()) {
      torre.pavimentos.sort((a, b) => b.ordem - a.ordem || a.label.localeCompare(b.label));
      for (const pav of torre.pavimentos) {
        pav.locais.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
      }
    }

    return Array.from(mapa.values()).sort((a, b) => a.chave.localeCompare(b.chave));
  }, [grade.locais]);

  function statusCelula(localId: number): StatusGrade {
    const statuses: StatusGrade[] = [];
    for (const srv of servicosVisiveis) {
      const s = grade.celulas[srv.id]?.[localId] ?? 'nao_avaliado';
      statuses.push(s);
    }
    return piorStatus(statuses);
  }

  if (torres.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-faint)] border border-dashed border-[var(--border-dim)] rounded-lg">
        Sem locais para exibir. Ajuste os filtros ou selecione outro pavimento.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-5 mb-4">
      {torres.map(torre => (
        <div
          key={torre.chave}
          className="flex flex-col rounded-xl border border-[var(--border-dim)] bg-[var(--bg-base)] overflow-hidden"
          style={{ minWidth: 220 }}
        >
          {/* Cabeçalho da torre */}
          <div className="px-3 py-2 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
            {torre.contexto && (
              <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide m-0">
                {torre.contexto}
              </p>
            )}
            <p className="text-sm font-semibold text-[var(--text-high)] m-0">{torre.label}</p>
          </div>

          {/* Pavimentos empilhados (DESC) */}
          <div className="flex flex-col">
            {torre.pavimentos.map((pav, idx) => (
              <div
                key={pav.id}
                className={cn(
                  'flex items-stretch',
                  idx > 0 && 'border-t border-[var(--border-dim)]',
                )}
              >
                {/* Label do pavimento (lateral) */}
                <div className="flex items-center justify-end px-2 py-2 min-w-[72px] max-w-[72px] bg-[var(--bg-raised)] border-r border-[var(--border-dim)]">
                  <span className="text-[11px] font-medium text-[var(--text-faint)] text-right leading-tight">
                    {pav.label}
                  </span>
                </div>
                {/* Células das unidades */}
                <div className="flex flex-wrap gap-1 p-2 flex-1">
                  {pav.locais.map(loc => {
                    const st = statusCelula(loc.id);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => onClickCelula?.(loc, servicosVisiveis.length === 1 ? servicosVisiveis[0].id : null)}
                        title={`${loc.nome} — ${st}`}
                        className={cn(
                          'flex items-center justify-center min-w-[44px] h-9 px-2 rounded-md border text-xs font-semibold transition-all',
                          CELL_CLS[st],
                          readOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-90 active:scale-95',
                        )}
                      >
                        {loc.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
