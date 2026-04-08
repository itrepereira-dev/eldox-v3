// frontend-web/src/modules/fvs/inspecao/hooks/useFichas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService, type CreateFichaPayload, type StatusFicha } from '../../../../services/fvs.service';

export function useFichas(obraId?: number, page = 1) {
  return useQuery({
    queryKey: ['fvs-fichas', obraId, page],
    queryFn: () => fvsService.getFichas({ obraId, page }),
  });
}

export function useFicha(id: number) {
  return useQuery({
    queryKey: ['fvs-ficha', id],
    queryFn: () => fvsService.getFicha(id),
    enabled: !!id,
  });
}

export function useCreateFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFichaPayload) => fvsService.createFicha(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-fichas'] }),
  });
}

export function usePatchFicha(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { nome?: string; status?: StatusFicha }) =>
      fvsService.patchFicha(fichaId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ficha', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-fichas'] });
    },
  });
}

export function useDeleteFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteFicha(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-fichas'] }),
  });
}
