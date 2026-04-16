// frontend-web/src/modules/ensaios/revisoes/hooks/useRevisoes.ts
// TanStack Query hooks para Revisões de Laudos — SPEC 3

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ensaiosService,
  type ListarRevisoesParams,
  type RevisarLaudoPayload,
} from '@/services/ensaios.service';

const KEY = ['ensaio-revisoes'] as const;
const KEY_LABORATORIAIS = ['ensaios-laboratoriais'] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export function useListarRevisoes(params: ListarRevisoesParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => ensaiosService.listarRevisoes(params),
    staleTime: 30_000,
    enabled: !!params.obra_id,
  });
}

export function useBuscarRevisao(id: number) {
  return useQuery({
    queryKey: [...KEY, 'detalhe', id],
    queryFn: () => ensaiosService.buscarRevisao(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useRevisarLaudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RevisarLaudoPayload }) =>
      ensaiosService.revisarLaudo(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: KEY_LABORATORIAIS });
    },
  });
}
