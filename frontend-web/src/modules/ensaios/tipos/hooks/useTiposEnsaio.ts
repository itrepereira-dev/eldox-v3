// frontend-web/src/modules/ensaios/tipos/hooks/useTiposEnsaio.ts
// TanStack Query hooks para Tipos de Ensaio — Sprint 5

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ensaiosService, type ListarTiposParams, type TipoEnsaioPayload } from '@/services/ensaios.service';

const QUERY_KEY = ['ensaio-tipos'] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export function useListarTipos(params?: ListarTiposParams) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => ensaiosService.listarTipos(params),
    staleTime: 30_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCriarTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TipoEnsaioPayload) => ensaiosService.criarTipo(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAtualizarTipo(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<TipoEnsaioPayload>) =>
      ensaiosService.atualizarTipo(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useToggleAtivo(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ensaiosService.toggleAtivo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeletarTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ensaiosService.deletarTipo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useSeedPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ensaiosService.seedPadrao(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
