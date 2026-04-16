// frontend-web/src/modules/almoxarifado/ia/hooks/useInsights.ts
import { useQuery } from '@tanstack/react-query'
import { almoxarifadoService } from '../../_service/almoxarifado.service'

export function useInsights(obraId: number) {
  return useQuery({
    queryKey:    ['alm-insights', obraId],
    queryFn:     () => almoxarifadoService.getInsights(obraId),
    enabled:     obraId > 0,
    staleTime:   5 * 60 * 1000,  // 5 min — análise IA é cara, não re-fetch a cada render
    gcTime:      10 * 60 * 1000,
  })
}
