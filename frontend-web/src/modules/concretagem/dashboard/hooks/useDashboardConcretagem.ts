// frontend-web/src/modules/concretagem/dashboard/hooks/useDashboardConcretagem.ts
import { useQuery } from '@tanstack/react-query';
import { concretagemService } from '@/services/concretagem.service';

export function useDashboardConcretagem(obraId: number) {
  return useQuery({
    queryKey: ['dashboard-concretagem', obraId],
    queryFn: () => concretagemService.getDashboard(obraId),
    staleTime: 30_000,
    enabled: !!obraId,
  });
}

export function useDashboardFinanceiro(obraId: number) {
  return useQuery({
    queryKey: ['concretagem-financeiro', obraId],
    queryFn: () => concretagemService.getFinanceiro(obraId),
    enabled: !!obraId,
    staleTime: 60_000,
  });
}
