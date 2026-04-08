// frontend-web/src/modules/fvs/catalogo/hooks/useCatalogo.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fvsService,
  type CreateCategoriaPayload,
  type CreateServicoPayload,
  type CreateItemPayload,
} from '../../../../services/fvs.service';

export function useCategorias() {
  return useQuery({
    queryKey: ['fvs-categorias'],
    queryFn: () => fvsService.getCategorias(),
  });
}

export function useServicos(categoriaId?: number) {
  return useQuery({
    queryKey: ['fvs-servicos', categoriaId],
    queryFn: () => fvsService.getServicos(categoriaId),
  });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCategoriaPayload) => fvsService.createCategoria(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-categorias'] }),
  });
}

export function useUpdateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<CreateCategoriaPayload>) =>
      fvsService.updateCategoria(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-categorias'] }),
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteCategoria(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-categorias'] }),
  });
}

export function useCreateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateServicoPayload) => fvsService.createServico(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useUpdateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<CreateServicoPayload>) =>
      fvsService.updateServico(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useDeleteServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteServico(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useClonarServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.clonarServico(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoId, ...payload }: { servicoId: number } & CreateItemPayload) =>
      fvsService.createItem(servicoId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}
