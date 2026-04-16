// frontend-web/src/modules/fvm/dashboard/components/FvmKpiCards.tsx
import { cn } from '@/lib/cn';
import type { FvmDashboardKpis } from '@/services/fvm.service';
import { Package, CheckCircle, AlertTriangle, Lock } from 'lucide-react';

interface Props {
  kpis: FvmDashboardKpis;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  colorClass: string;
}

function KpiCard({ label, value, sub, icon, colorClass }: KpiCardProps) {
  return (
    <div className="border border-[var(--border-dim)] rounded-lg px-4 py-3 bg-[var(--bg-raised)] flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-faint)]">{label}</p>
        <span className={cn('opacity-60', colorClass)}>{icon}</span>
      </div>
      <p className={cn('text-2xl font-bold', colorClass)}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-faint)]">{sub}</p>}
    </div>
  );
}

export function FvmKpiCards({ kpis }: Props) {
  const taxaColor =
    kpis.taxa_aprovacao >= 80
      ? 'text-[var(--ok-text)]'
      : kpis.taxa_aprovacao >= 60
      ? 'text-yellow-600'
      : 'text-[var(--nc-text)]';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <KpiCard
        label="Lotes Recebidos"
        value={kpis.lotes_recebidos_total}
        sub={`${kpis.lotes_aprovados} aprovados`}
        icon={<Package size={18} />}
        colorClass="text-[var(--text-high)]"
      />
      <KpiCard
        label="Taxa de Aprovação"
        value={`${kpis.taxa_aprovacao}%`}
        sub={kpis.lotes_reprovados > 0 ? `${kpis.lotes_reprovados} reprovados` : 'sem reprovações'}
        icon={<CheckCircle size={18} />}
        colorClass={taxaColor}
      />
      <KpiCard
        label="NCs Abertas"
        value={kpis.ncs_abertas}
        sub={kpis.ncs_criticas_abertas > 0 ? `${kpis.ncs_criticas_abertas} críticas` : 'nenhuma crítica'}
        icon={<AlertTriangle size={18} />}
        colorClass={kpis.ncs_abertas > 0 ? 'text-[var(--warn-text)]' : 'text-[var(--text-high)]'}
      />
      <KpiCard
        label="Em Quarentena"
        value={kpis.lotes_em_quarentena}
        sub={`${kpis.ensaios_reprovados} ensaios reprovados`}
        icon={<Lock size={18} />}
        colorClass={kpis.lotes_em_quarentena > 0 ? 'text-orange-500' : 'text-[var(--text-high)]'}
      />
    </div>
  );
}
