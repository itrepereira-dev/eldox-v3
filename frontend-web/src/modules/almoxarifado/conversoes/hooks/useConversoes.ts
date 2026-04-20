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

/**
 * Hook para preview de conversão em tempo real (não persiste nada).
 * Retorna { isLoading, data: {quantidade, fator}, error } pronto pra UI.
 *
 * - Se origem === destino ou algum dos dois estiver vazio, fica disabled
 *   e data vem undefined — componente deve tratar como "sem conversão
 *   necessária".
 * - Se não houver regra cadastrada no backend, cai em error com mensagem
 *   do backend (`ConversaoNotFoundException`).
 */
export function useConversaoPreview(
  params: {
    catalogoId: number | null;
    quantidade: number;
    unidadeOrigem: string | null | undefined;
    unidadeDestino: string | null | undefined;
  },
) {
  const origem = (params.unidadeOrigem ?? '').toUpperCase().trim();
  const destino = (params.unidadeDestino ?? '').toUpperCase().trim();
  const enabled = !!origem && !!destino && origem !== destino && params.quantidade > 0;

  return useQuery({
    queryKey: ['conv-preview', params.catalogoId, params.quantidade, origem, destino],
    queryFn: () => almoxarifadoService.converterUm({
      catalogoId: params.catalogoId,
      quantidade: params.quantidade,
      unidadeOrigem: origem,
      unidadeDestino: destino,
    }),
    enabled,
    retry: false,           // não fazer retry se conversão não existe
    staleTime: 5 * 60_000,  // conversões mudam raramente
  });
}
