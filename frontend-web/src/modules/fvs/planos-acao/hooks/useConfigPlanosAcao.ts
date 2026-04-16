// frontend-web/src/modules/fvs/planos-acao/hooks/useConfigPlanosAcao.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  planosAcaoService,
  type PaModulo,
  type PaCampoTipo,
  type PaCondicao,
} from '../../../../services/planos-acao.service';

export function useCiclos(modulo?: string) {
  return useQuery({
    queryKey: ['pa-ciclos', modulo],
    queryFn: () => planosAcaoService.getCiclos(modulo),
  });
}

export function useCreateCiclo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { modulo: PaModulo; nome: string; descricao?: string }) =>
      planosAcaoService.createCiclo(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-ciclos'] }),
  });
}

export function useUpdateCiclo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nome?: string; descricao?: string; ativo?: boolean } }) =>
      planosAcaoService.updateCiclo(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-ciclos'] }),
  });
}

export function useDeleteCiclo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deleteCiclo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-ciclos'] }),
  });
}

export function useEtapas(cicloId: number) {
  return useQuery({
    queryKey: ['pa-etapas', cicloId],
    queryFn: () => planosAcaoService.getEtapas(cicloId),
    enabled: !!cicloId,
  });
}

export function useCreateEtapa(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      nome: string; ordem: number; cor?: string;
      isInicial?: boolean; isFinal?: boolean;
      prazoDias?: number; rolesTransicao?: string[];
    }) => planosAcaoService.createEtapa(cicloId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] });
      qc.invalidateQueries({ queryKey: ['pa-ciclos'] });
    },
  });
}

export function useUpdateEtapa(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: number;
      data: { nome?: string; ordem?: number; cor?: string; prazoDias?: number | null; rolesTransicao?: string[] };
    }) => planosAcaoService.updateEtapa(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] }),
  });
}

export function useDeleteEtapa(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deleteEtapa(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] }),
  });
}

export function useCreateCampo(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ etapaId, data }: {
      etapaId: number;
      data: { nome: string; chave: string; tipo: PaCampoTipo; opcoes?: string[]; obrigatorio?: boolean; ordem?: number };
    }) => planosAcaoService.createCampo(etapaId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] }),
  });
}

export function useDeleteCampo(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deleteCampo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] }),
  });
}

export function useGatilhos(cicloId: number) {
  return useQuery({
    queryKey: ['pa-gatilhos', cicloId],
    queryFn: () => planosAcaoService.getGatilhos(cicloId),
    enabled: !!cicloId,
  });
}

export function useCreateGatilho(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { condicao: PaCondicao; valorLimiar?: number; criticidadeMin?: string }) =>
      planosAcaoService.createGatilho(cicloId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-gatilhos', cicloId] }),
  });
}

export function useDeleteGatilho(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deleteGatilho(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-gatilhos', cicloId] }),
  });
}
