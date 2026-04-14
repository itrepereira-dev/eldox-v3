// frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService } from '../../../../services/fvs.service';

export function useGrade(fichaId: number, params?: { pavimentoId?: number; servicoId?: number }) {
  return useQuery({
    queryKey: ['fvs-grade', fichaId, params],
    queryFn: () => fvsService.getGrade(fichaId, params),
    enabled: !!fichaId,
    staleTime: 10_000,
  });
}

export function useGradePreview(fichaId: number, localId: number | null, servicoId: number | null) {
  return useQuery({
    queryKey: ['fvs-grade-preview', fichaId, localId, servicoId],
    queryFn: () => fvsService.getGradePreview(fichaId, localId!, servicoId!),
    enabled: !!fichaId && localId !== null && servicoId !== null,
  });
}

export function useBulkInspecao(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { servicoId: number; localIds: number[]; status: 'conforme' | 'excecao'; observacao?: string }) =>
      fvsService.bulkInspecaoLocais(fichaId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-grade', fichaId] });
    },
  });
}
