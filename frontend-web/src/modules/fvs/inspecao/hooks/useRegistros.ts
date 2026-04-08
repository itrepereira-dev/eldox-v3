// frontend-web/src/modules/fvs/inspecao/hooks/useRegistros.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService, type StatusRegistro } from '../../../../services/fvs.service';

export function useRegistros(fichaId: number, servicoId: number, localId: number) {
  return useQuery({
    queryKey: ['fvs-registros', fichaId, servicoId, localId],
    queryFn: () => fvsService.getRegistros(fichaId, servicoId, localId),
    enabled: !!fichaId && !!servicoId && !!localId,
  });
}

export function usePutRegistro(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      servicoId: number; itemId: number; localId: number;
      status: StatusRegistro; observacao?: string;
    }) => fvsService.putRegistro(fichaId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fvs-registros', fichaId, vars.servicoId, vars.localId] });
      qc.invalidateQueries({ queryKey: ['fvs-grade', fichaId] });
    },
  });
}

export function usePatchLocal(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, equipeResponsavel }: { localId: number; equipeResponsavel?: string | null }) =>
      fvsService.patchLocal(fichaId, localId, { equipeResponsavel }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-registros', fichaId] }),
  });
}

export function useEvidencias(registroId: number | null) {
  return useQuery({
    queryKey: ['fvs-evidencias', registroId],
    queryFn: () => fvsService.getEvidencias(registroId!),
    enabled: !!registroId,
  });
}

export function useCreateEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registroId, file }: { registroId: number; file: File }) =>
      fvsService.createEvidencia(registroId, file),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fvs-evidencias', vars.registroId] });
      qc.invalidateQueries({ queryKey: ['fvs-registros'] });
    },
  });
}

export function useDeleteEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, registroId }: { id: number; registroId: number }) =>
      fvsService.deleteEvidencia(id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fvs-evidencias', vars.registroId] });
      qc.invalidateQueries({ queryKey: ['fvs-registros'] });
    },
  });
}
