// frontend-web/src/modules/fvs/dashboard/hooks/useDashboardGraficos.ts
import { useQuery } from '@tanstack/react-query';
import { fvsService, type DashboardGraficosData, type GraficosFiltros } from '../../../../services/fvs.service';

export function useDashboardGraficos(obraId: number, filtros: GraficosFiltros) {
  return useQuery<DashboardGraficosData>({
    queryKey: ['fvs-graficos', obraId, filtros],
    queryFn: () => fvsService.getDashboardGraficos(obraId, filtros),
    staleTime: 5 * 60_000,
    enabled: obraId > 0,
  });
}
