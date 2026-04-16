// frontend-web/src/modules/ncs/hooks/useNcs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ncsService,
  type ListNcsParams,
  type CreateNcPayload,
  type UpdateNcPayload,
} from '../../../services/ncs.service';

// ── Listar por obra ──────────────────────────────────────────────────────────

export function useNcsPorObra(obraId: number, params: ListNcsParams = {}) {
  return useQuery({
    queryKey: ['ncs', 'obra', obraId, params],
    queryFn: () => ncsService.listarPorObra(obraId, params),
    enabled: !!obraId,
  });
}

// ── Listar global ────────────────────────────────────────────────────────────

export function useNcsGlobal(params: ListNcsParams = {}) {
  return useQuery({
    queryKey: ['ncs', 'global', params],
    queryFn: () => ncsService.listarGlobal(params),
  });
}

// ── Detalhe ──────────────────────────────────────────────────────────────────

export function useNc(ncId: number) {
  return useQuery({
    queryKey: ['ncs', 'detalhe', ncId],
    queryFn: () => ncsService.buscar(ncId),
    enabled: !!ncId,
  });
}

// ── Criar ────────────────────────────────────────────────────────────────────

export function useCreateNc(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateNcPayload) => ncsService.criar(obraId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ncs', 'obra', obraId] });
      qc.invalidateQueries({ queryKey: ['ncs', 'global'] });
    },
  });
}

// ── Atualizar ────────────────────────────────────────────────────────────────

export function useUpdateNc(ncId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateNcPayload) => ncsService.atualizar(ncId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ncs', 'detalhe', ncId] });
      qc.invalidateQueries({ queryKey: ['ncs', 'obra'] });
      qc.invalidateQueries({ queryKey: ['ncs', 'global'] });
    },
  });
}

// ── Deletar ──────────────────────────────────────────────────────────────────

export function useDeleteNc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ncId: number) => ncsService.deletar(ncId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ncs'] });
    },
  });
}
