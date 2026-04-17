// frontend-web/src/modules/almoxarifado/ia/hooks/useInsights.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { almoxarifadoService } from '../../_service/almoxarifado.service';

export function useInsights() {
  return useQuery({
    queryKey:  ['alm-insights'],
    queryFn:   () => almoxarifadoService.getInsights(),
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
  });
}

export function useAplicarSugestao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.aplicarSugestao(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['alm-insights'] });
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes'] });
    },
  });
}

export function useIgnorarSugestao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.ignorarSugestao(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['alm-insights'] }),
  });
}

export function useReanalisarInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => almoxarifadoService.reanalisarInsights(),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['alm-insights'] }),
  });
}
