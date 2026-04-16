// frontend-web/src/modules/concretagem/concretagens/components/CpTimeline.tsx
import { cn } from '@/lib/cn';

interface CpItem {
  id: number;
  numero: string;
  caminhao_id: number;
  caminhao_numero?: string;
  caminhao_nf?: string;
  idade_dias: number;
  data_ruptura_prev: string | null;
  data_ruptura_real: string | null;
  resistencia: number | null;
  status: 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';
}

interface CaminhaoGroup {
  caminhao_id: number;
  numero: string;
  nf: string;
  cps: CpItem[];
}

interface CpTimelineProps {
  cps: CpItem[];
}

function DotStatus({ cp }: { cp: CpItem | undefined }) {
  if (!cp) {
    return (
      <div className="flex flex-col items-center gap-1 flex-1">
        <div className="w-5 h-5 rounded-full border-2 border-dashed border-[var(--border-dim)] flex items-center justify-center">
          <span className="text-[8px] text-[var(--text-faint)]">—</span>
        </div>
        <span className="text-[9px] text-[var(--text-faint)]">—</span>
      </div>
    );
  }

  if (cp.status === 'AGUARDANDO_RUPTURA') {
    const vencido = cp.data_ruptura_prev && new Date(cp.data_ruptura_prev) < new Date();
    return (
      <div className="flex flex-col items-center gap-1 flex-1">
        <div className={cn(
          'w-5 h-5 rounded-full border-2 border-dashed flex items-center justify-center',
          vencido ? 'border-[var(--warn)] bg-[var(--warn-dim)]' : 'border-[var(--border-dim)] bg-[var(--bg-raised)]',
        )}>
          <span className="text-[8px]">{vencido ? '⏱' : '…'}</span>
        </div>
        <span className="text-[9px] text-[var(--text-faint)]">
          {cp.data_ruptura_prev
            ? new Date(cp.data_ruptura_prev).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : '—'}
        </span>
      </div>
    );
  }

  const aprovado = cp.status === 'ROMPIDO_APROVADO';
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center',
        aprovado
          ? 'bg-[var(--ok)] border-[var(--ok-text)]'
          : 'bg-red-500 border-red-900',
      )}>
        <span className="text-[8px] text-white">{aprovado ? '✓' : '✗'}</span>
      </div>
      <span className={cn('text-[9px] font-medium', aprovado ? 'text-[var(--ok-text)]' : 'text-red-400')}>
        {cp.resistencia} MPa
      </span>
    </div>
  );
}

export function CpTimeline({ cps }: CpTimelineProps) {
  // Agrupar por caminhão
  const groups: CaminhaoGroup[] = [];
  const seen = new Map<number, CaminhaoGroup>();

  for (const cp of cps) {
    if (!seen.has(cp.caminhao_id)) {
      const g: CaminhaoGroup = {
        caminhao_id: cp.caminhao_id,
        numero: cp.caminhao_numero ?? `CAM-${cp.caminhao_id}`,
        nf: cp.caminhao_nf ?? '—',
        cps: [],
      };
      seen.set(cp.caminhao_id, g);
      groups.push(g);
    }
    seen.get(cp.caminhao_id)!.cps.push(cp);
  }

  const IDADES = [3, 7, 28];

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--text-faint)] text-center py-8">
        Nenhum corpo de prova registrado.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.caminhao_id}>
          <p className="text-xs font-semibold text-[var(--text-med)] mb-3">
            🚛 {g.numero} · NF {g.nf}
          </p>
          <div className="flex items-stretch gap-0 relative">
            {/* Linha de conexão */}
            <div className="absolute top-2.5 left-[12.5%] right-[12.5%] h-px bg-[var(--border-dim)] z-0" />
            {IDADES.map((idade) => {
              const cp = g.cps.find((c) => c.idade_dias === idade);
              return (
                <div key={idade} className="flex flex-col items-center flex-1 z-10">
                  <DotStatus cp={cp} />
                  <span className="text-[10px] text-[var(--text-faint)] mt-1 font-medium">{idade}d</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
