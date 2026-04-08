// frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts
import { useQuery } from '@tanstack/react-query';
import { fvsService } from '../../../../services/fvs.service';

export function useGrade(fichaId: number, filtros?: { pavimentoId?: number; servicoId?: number }) {
  return useQuery({
    queryKey: ['fvs-grade', fichaId, filtros],
    queryFn: () => fvsService.getGrade(fichaId, filtros),
    enabled: !!fichaId,
    staleTime: 10_000,
  });
}
