// frontend-web/src/modules/concretagem/concretagens/components/CpTabela.tsx
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

interface CpTabelaProps {
  cps: CpItem[];
  fck: number;
}

const STATUS_LABEL: Record<CpItem['status'], string> = {
  AGUARDANDO_RUPTURA: 'Aguardando',
  ROMPIDO_APROVADO:   '✓ Aprovado',
  ROMPIDO_REPROVADO:  '✗ Reprovado',
  CANCELADO:          'Cancelado',
};

const STATUS_COLOR: Record<CpItem['status'], string> = {
  AGUARDANDO_RUPTURA: 'text-[var(--text-faint)]',
  ROMPIDO_APROVADO:   'text-[var(--ok-text)]',
  ROMPIDO_REPROVADO:  'text-red-400',
  CANCELADO:          'text-[var(--text-faint)] line-through',
};

export function CpTabela({ cps, fck }: CpTabelaProps) {
  const formatData = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  if (cps.length === 0) {
    return (
      <p className="text-sm text-[var(--text-faint)] text-center py-8">
        Nenhum corpo de prova registrado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border-dim)]">
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Nº CP</th>
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Caminhão</th>
            <th className="text-right px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Idade</th>
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Data Prev.</th>
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Data Real</th>
            <th className="text-right px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Resist. (MPa)</th>
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {cps.map((cp) => (
            <tr key={cp.id} className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)]">
              <td className="px-3 py-2.5 font-mono text-xs text-[var(--accent)]">{cp.numero}</td>
              <td className="px-3 py-2.5 text-xs text-[var(--text-med)]">{cp.caminhao_numero ?? `CAM-${cp.caminhao_id}`}</td>
              <td className="px-3 py-2.5 text-xs text-right text-[var(--text-med)]">{cp.idade_dias}d</td>
              <td className="px-3 py-2.5 text-xs text-[var(--text-faint)]">{formatData(cp.data_ruptura_prev)}</td>
              <td className="px-3 py-2.5 text-xs text-[var(--text-faint)]">{formatData(cp.data_ruptura_real)}</td>
              <td className="px-3 py-2.5 text-xs text-right font-medium text-[var(--text-high)]">
                {cp.resistencia != null ? cp.resistencia : '—'}
              </td>
              <td className={cn('px-3 py-2.5 text-xs font-medium', STATUS_COLOR[cp.status])}>
                {STATUS_LABEL[cp.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--text-faint)] mt-2 px-1">fck especificado: {fck} MPa</p>
    </div>
  );
}
