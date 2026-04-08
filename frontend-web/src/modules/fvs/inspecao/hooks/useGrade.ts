// frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts
import { useQuery } from '@tanstack/react-query';
import { fvsService } from '../../../../services/fvs.service';

export function useGrade(
  fichaId: number,
  pavimentoId?: number,
  servicoId?: number,
) {
  return useQuery({
    queryKey: ['fvs-grade', fichaId, pavimentoId, servicoId],
    queryFn: () => fvsService.getGrade(fichaId, { pavimentoId, servicoId }),
    enabled: !!fichaId,
    staleTime: 10_000,
  });
}
