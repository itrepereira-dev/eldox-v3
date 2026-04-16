import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aprovacoesService, type DecidrirDto, type DelegarDto } from '../../../services/aprovacoes.service';

export function useAprovacoes(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['aprovacoes', 'lista', params],
    queryFn: () => aprovacoesService.listar(params),
  });
}

export function usePendentesParaMim() {
  return useQuery({
    queryKey: ['aprovacoes', 'pendentes-para-mim'],
    queryFn: () => aprovacoesService.pendentesParaMim(),
    refetchInterval: 60_000,
  });
}

export function useContagemPendentes() {
  return useQuery({
    queryKey: ['aprovacoes', 'contagem'],
    queryFn: () => aprovacoesService.contagemPendentes(),
    refetchInterval: 60_000,
  });
}

export function useAprovacao(id: number) {
  return useQuery({
    queryKey: ['aprovacoes', 'detalhe', id],
    queryFn: () => aprovacoesService.buscar(id),
    enabled: !!id,
  });
}

export function useDecidir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: DecidrirDto }) =>
      aprovacoesService.decidir(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aprovacoes'] });
    },
  });
}

export function useCancelar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      aprovacoesService.cancelar(id, motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aprovacoes'] }),
  });
}

export function useDelegar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: DelegarDto }) =>
      aprovacoesService.delegar(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aprovacoes'] }),
  });
}

export function useReabrir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => aprovacoesService.reabrir(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aprovacoes'] }),
  });
}
