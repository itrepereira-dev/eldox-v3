// frontend-web/src/modules/fvs/inspecao/hooks/useRo.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fvsService,
  type RoOcorrencia,
  type RoServicoNc,
  type RoServicoEvidencia,
  type StatusRo,
  type SubmitParecerPayload,
  type FichaFvs,
} from '../../../../services/fvs.service';

export function useRo(fichaId: number, enabled = true) {
  return useQuery<RoOcorrencia, Error>({
    queryKey: ['fvs-ro', fichaId],
    queryFn: () => fvsService.getRo(fichaId),
    enabled: !!fichaId && enabled,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 3;
    },
  });
}

export function usePatchRo(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      tipo?: 'real' | 'potencial';
      o_que_aconteceu?: string | null;
      acao_imediata?: string | null;
      causa_6m?: string | null;
      justificativa_causa?: string | null;
      status?: StatusRo;
    }) => fvsService.patchRo(fichaId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ro', fichaId] });
    },
  });
}

export function usePatchServicoNc(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoNcId, payload }: {
      servicoNcId: number;
      payload: {
        acao_corretiva?: string | null;
        desbloquear?: boolean;
        verificar?: boolean;
      };
    }): Promise<RoServicoNc> => fvsService.patchServicoNc(fichaId, servicoNcId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ro', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-grade', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-registros', fichaId] });
    },
  });
}

export function useCreateRoEvidencia(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoNcId, file }: { servicoNcId: number; file: File }): Promise<RoServicoEvidencia> =>
      fvsService.createRoEvidencia(fichaId, servicoNcId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ro', fichaId] });
    },
  });
}

export function useDeleteRoEvidencia(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoNcId, evidenciaId }: { servicoNcId: number; evidenciaId: number }): Promise<void> =>
      fvsService.deleteRoEvidencia(fichaId, servicoNcId, evidenciaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ro', fichaId] });
    },
  });
}

export function useSolicitarParecer(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (): Promise<FichaFvs> => fvsService.solicitarParecer(fichaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ficha', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-fichas'] });
    },
  });
}

export function useSubmitParecer(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitParecerPayload): Promise<FichaFvs> => fvsService.submitParecer(fichaId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ficha', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-fichas'] });
      qc.invalidateQueries({ queryKey: ['fvs-grade', fichaId] });
    },
  });
}
