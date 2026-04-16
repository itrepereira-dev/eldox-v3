// frontend-web/src/modules/fvs/modelos/hooks/useModelos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService, type CreateModeloPayload, type CreateModeloServicoPayload } from '../../../../services/fvs.service';

export function useModelos(params?: { escopo?: string; status?: string }) {
  return useQuery({
    queryKey: ['fvs-modelos', params],
    queryFn: () => fvsService.getModelos(params),
  });
}

export function useModelo(id: number) {
  return useQuery({
    queryKey: ['fvs-modelo', id],
    queryFn: () => fvsService.getModelo(id),
    enabled: !!id,
  });
}

export function useCreateModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateModeloPayload) => fvsService.createModelo(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelos'] }),
  });
}

export function useUpdateModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<CreateModeloPayload>) =>
      fvsService.updateModelo(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['fvs-modelos'] });
      qc.invalidateQueries({ queryKey: ['fvs-modelo', id] });
    },
  });
}

export function useDeleteModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteModelo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelos'] }),
  });
}

export function useConcluirModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.concluirModelo(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['fvs-modelos'] });
      qc.invalidateQueries({ queryKey: ['fvs-modelo', id] });
    },
  });
}

export function useReabrirModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.reabrirModelo(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['fvs-modelos'] });
      qc.invalidateQueries({ queryKey: ['fvs-modelo', id] });
    },
  });
}

export function useDuplicarModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.duplicarModelo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelos'] }),
  });
}

export function useAddServicoModelo(modeloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateModeloServicoPayload) => fvsService.addServicoModelo(modeloId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelo', modeloId] }),
  });
}

export function useDeleteServicoModelo(modeloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (servicoId: number) => fvsService.deleteServicoModelo(modeloId, servicoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelo', modeloId] }),
  });
}

export function useObrasModelo(modeloId: number) {
  return useQuery({
    queryKey: ['modelo-obras', modeloId],
    queryFn: () => fvsService.getObrasModelo(modeloId),
    enabled: !!modeloId,
  });
}

export function useVincularObrasModelo(modeloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (obraIds: number[]) => fvsService.vincularModeloObras(modeloId, obraIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modelo-obras', modeloId] }),
  });
}

export function useDesvincularObraModelo(modeloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (obraId: number) => fvsService.desvincularModeloObraByModelo(modeloId, obraId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modelo-obras', modeloId] }),
  });
}

export function useModelosByObra(obraId: number) {
  return useQuery({
    queryKey: ['obra-modelos', obraId],
    queryFn: () => fvsService.getModelosByObra(obraId),
    enabled: !!obraId,
  });
}

export function useVincularModeloObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obraId, modeloId }: { obraId: number; modeloId: number }) =>
      fvsService.vincularModeloObras(modeloId, [obraId]),
    onSuccess: (_, { obraId }) => qc.invalidateQueries({ queryKey: ['obra-modelos', obraId] }),
  });
}

export function useDesvincularModeloObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obraId, modeloId }: { obraId: number; modeloId: number }) =>
      fvsService.desvincularModeloObra(obraId, modeloId),
    onSuccess: (_, { obraId }) => qc.invalidateQueries({ queryKey: ['obra-modelos', obraId] }),
  });
}
