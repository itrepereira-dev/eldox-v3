// frontend-web/src/modules/almoxarifado/transferencias/hooks/useTransferencias.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  almoxarifadoService,
  type AlmTransferenciaStatus,
  type CreateTransferenciaPayload,
  type ExecutarTransferenciaPayload,
} from '../../_service/almoxarifado.service';

export function useTransferencias(filters?: {
  status?: AlmTransferenciaStatus;
  local_origem_id?: number;
  local_destino_id?: number;
  page?: number;
  per_page?: number;
}) {
  return useQuery({
    queryKey: ['alm-transferencias', filters],
    queryFn: () => almoxarifadoService.listarTransferencias(filters),
    staleTime: 15_000,
  });
}

export function useTransferencia(id: number | undefined) {
  return useQuery({
    queryKey: ['alm-transferencia', id],
    queryFn: () => almoxarifadoService.buscarTransferencia(id!),
    enabled: id !== undefined,
  });
}

export function useCriarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTransferenciaPayload) => almoxarifadoService.criarTransferencia(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-transferencias'] }),
  });
}

export function useAprovarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.aprovarTransferencia(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['alm-transferencias'] });
      qc.invalidateQueries({ queryKey: ['alm-transferencia', id] });
    },
  });
}

export function useExecutarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto?: ExecutarTransferenciaPayload }) =>
      almoxarifadoService.executarTransferencia(id, dto),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['alm-transferencias'] });
      qc.invalidateQueries({ queryKey: ['alm-transferencia', id] });
    },
  });
}

export function useCancelarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      almoxarifadoService.cancelarTransferencia(id, motivo),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['alm-transferencias'] });
      qc.invalidateQueries({ queryKey: ['alm-transferencia', id] });
    },
  });
}
