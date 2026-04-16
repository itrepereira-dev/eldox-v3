// frontend-web/src/modules/fvs/planos-acao/hooks/usePlanosAcao.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  planosAcaoService,
  type PaPrioridade,
} from '../../../../services/planos-acao.service';

export function usePlanosAcao(params: {
  obraId?: number; etapaId?: number; prioridade?: string;
  responsavelId?: number; modulo?: string; page?: number; limit?: number;
}) {
  return useQuery({
    queryKey: ['pa-list', params],
    queryFn: () => planosAcaoService.listPas(params),
  });
}

export function usePlanoAcao(id: number) {
  return useQuery({
    queryKey: ['pa-detail', id],
    queryFn: () => planosAcaoService.getPa(id),
    enabled: !!id,
  });
}

export function useCreatePa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      cicloId: number; obraId: number; titulo: string; descricao?: string;
      prioridade?: PaPrioridade; responsavelId?: number; prazo?: string;
      origemTipo?: string; origemId?: number; camposExtras?: Record<string, unknown>;
    }) => planosAcaoService.createPa(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-list'] }),
  });
}

export function useUpdatePa(paId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      titulo?: string; descricao?: string; prioridade?: PaPrioridade;
      responsavelId?: number; prazo?: string;
    }) => planosAcaoService.updatePa(paId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pa-detail', paId] });
      qc.invalidateQueries({ queryKey: ['pa-list'] });
    },
  });
}

export function useTransicionarEtapa(paId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      etapaParaId: number; comentario?: string; camposExtras?: Record<string, unknown>;
    }) => planosAcaoService.transicionarEtapa(paId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pa-detail', paId] });
      qc.invalidateQueries({ queryKey: ['pa-list'] });
    },
  });
}

export function useDeletePa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deletePa(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-list'] }),
  });
}
