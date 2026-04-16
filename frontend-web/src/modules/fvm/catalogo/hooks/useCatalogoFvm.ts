// frontend-web/src/modules/fvm/catalogo/hooks/useCatalogoFvm.ts
// Hooks de catálogo — separados do useGradeFvm para isolar mutações de edição

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvmService } from '@/services/fvm.service';
import type { FvmMaterial, FvmItem } from '@/services/fvm.service';

// ── Read ──────────────────────────────────────────────────────────────────────

export { useCategoriasMateriais, useMateriais } from '../../grade/hooks/useGradeFvm';

// ── Mutações de Material ──────────────────────────────────────────────────────

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<FvmMaterial>) => fvmService.createMaterial(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-materiais'] });
      qc.invalidateQueries({ queryKey: ['fvm-categorias'] });
    },
  });
}

export function useUpdateMaterial(materialId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<FvmMaterial>) => fvmService.updateMaterial(materialId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-materiais'] });
      qc.invalidateQueries({ queryKey: ['fvm-material', materialId] });
    },
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvmService.deleteMaterial(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-materiais'] });
      qc.invalidateQueries({ queryKey: ['fvm-categorias'] });
    },
  });
}

// ── Material com itens ────────────────────────────────────────────────────────

export function useMaterialDetalhe(materialId: number | null) {
  return useQuery({
    queryKey: ['fvm-material', materialId],
    queryFn:  () => fvmService.getMaterial(materialId!),
    enabled:  !!materialId,
    staleTime: 30_000,
  });
}

// ── Mutações de Item ──────────────────────────────────────────────────────────

export function useCreateItem(materialId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<FvmItem>) => fvmService.createItem(materialId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvm-material', materialId] }),
  });
}

export function useUpdateItem(materialId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<FvmItem> & { id: number }) =>
      fvmService.updateItem(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvm-material', materialId] }),
  });
}

export function useDeleteItem(materialId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvmService.deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvm-material', materialId] }),
  });
}
