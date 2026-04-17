// frontend-web/src/modules/almoxarifado/locais/hooks/useLocais.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { almoxarifadoService, type AlmLocal, type AlmLocalTipo, type CreateLocalPayload } from '../../_service/almoxarifado.service';

export function useLocais(filters?: { tipo?: AlmLocalTipo; ativo?: boolean; obra_id?: number }) {
  return useQuery({
    queryKey: ['alm-locais', filters],
    queryFn: () => almoxarifadoService.listarLocais(filters),
    staleTime: 30_000,
  });
}

export function useCriarLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLocalPayload) => almoxarifadoService.criarLocal(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-locais'] }),
  });
}

export function useAtualizarLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateLocalPayload> }) =>
      almoxarifadoService.atualizarLocal(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-locais'] }),
  });
}

export function useDesativarLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.desativarLocal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-locais'] }),
  });
}
