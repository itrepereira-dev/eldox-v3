// frontend-web/src/modules/ensaios/laboratoriais/hooks/useEnsaios.ts
// TanStack Query hooks para Ensaios Laboratoriais — SPEC 2

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ensaiosService,
  type ListarEnsaiosParams,
  type CreateEnsaioPayload,
} from '@/services/ensaios.service';

const KEY = ['ensaios-laboratoriais'] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export function useListarEnsaios(params: ListarEnsaiosParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => ensaiosService.listarEnsaios(params),
    staleTime: 30_000,
    enabled: !!params.obra_id,
  });
}

export function useBuscarEnsaio(id: number) {
  return useQuery({
    queryKey: [...KEY, 'detalhe', id],
    queryFn: () => ensaiosService.buscarEnsaio(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCriarEnsaio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEnsaioPayload) => ensaiosService.criarEnsaio(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
