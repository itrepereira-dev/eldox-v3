// frontend-web/src/modules/ensaios/dashboard/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { ensaiosService } from '@/services/ensaios.service';

export function useDashboardMateriais(obraId: number) {
  return useQuery({
    queryKey: ['dashboard', 'materiais', obraId],
    queryFn: () => ensaiosService.getDashboardMateriais(obraId),
    enabled: obraId > 0,
    staleTime: 60_000, // 60s — SPEC 5
  });
}
