// frontend-web/src/modules/almoxarifado/conversoes/hooks/useConversoes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  almoxarifadoService,
  type UpsertConversaoPayload,
  type ConverterPayload,
  type CalcularCompraPayload,
} from '../../_service/almoxarifado.service';

export function useConversoes() {
  return useQuery({
    queryKey: ['alm-conversoes'],
    queryFn: () => almoxarifadoService.listarConversoes(),
    staleTime: 5 * 60_000, // 5 min — conversões mudam raramente
  });
}

export function useUpsertConversao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpsertConversaoPayload) => almoxarifadoService.upsertConversao(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-conversoes'] }),
  });
}

export function useConverterUm() {
  return useMutation({
    mutationFn: (dto: ConverterPayload) => almoxarifadoService.converterUm(dto),
  });
}

export function useCalcularCompra() {
  return useMutation({
    mutationFn: (dto: CalcularCompraPayload) => almoxarifadoService.calcularCompra(dto),
  });
}
