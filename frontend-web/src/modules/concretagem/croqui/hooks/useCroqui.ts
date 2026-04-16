// frontend-web/src/modules/concretagem/croqui/hooks/useCroqui.ts
// TanStack Query hooks para Croquis de Rastreabilidade — SPEC 7

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  concretagemService,
  type CreateCroquiPayload,
  type UpdateCroquiPayload,
} from '@/services/concretagem.service';

const KEY = (obraId: number) => ['croquis', obraId] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export function useListarCroquis(obraId: number) {
  return useQuery({
    queryKey: KEY(obraId),
    queryFn: () => concretagemService.listar(obraId),
    staleTime: 30_000,
    enabled: !!obraId,
  });
}

export function useBuscarCroqui(obraId: number, croquiId: number) {
  return useQuery({
    queryKey: [...KEY(obraId), 'detalhe', croquiId],
    queryFn: () => concretagemService.buscar(obraId, croquiId),
    staleTime: 30_000,
    enabled: !!obraId && !!croquiId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCriarCroqui(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCroquiPayload) =>
      concretagemService.criar(obraId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(obraId) }),
  });
}

export function useAtualizarCroqui(obraId: number, croquiId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCroquiPayload) =>
      concretagemService.atualizar(obraId, croquiId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(obraId) }),
  });
}

export function useDeletarCroqui(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (croquiId: number) => concretagemService.deletar(obraId, croquiId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(obraId) }),
  });
}
