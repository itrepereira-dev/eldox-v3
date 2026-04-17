// frontend-web/src/modules/almoxarifado/compras/hooks/useCompras.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { almoxarifadoService } from '../../_service/almoxarifado.service'
import type { CreateOcPayload, ReceberOcItemPayload } from '../../_service/almoxarifado.service'

export function useOcs(
  _obraId?: number,
  params?: { status?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['alm-ocs', _obraId, params?.status],
    queryFn:  () => almoxarifadoService.getOcs(params),
    enabled:  true,
  })
}

export function useOc(id: number) {
  return useQuery({
    queryKey: ['alm-oc', id],
    queryFn:  () => almoxarifadoService.getOc(id),
    enabled:  id > 0,
  })
}

export function useCriarOc(_obraId?: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOcPayload) => almoxarifadoService.criarOc(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs'] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}

export function useConfirmarOc(_obraId: number | undefined, ocId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.confirmarOc(ocId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs'] })
      qc.invalidateQueries({ queryKey: ['alm-oc', ocId] })
    },
  })
}

export function useEmitirOc(_obraId: number | undefined, ocId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.emitirOc(ocId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs'] })
      qc.invalidateQueries({ queryKey: ['alm-oc', ocId] })
    },
  })
}

export function useReceberOcItens(_obraId: number | undefined, ocId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itens: ReceberOcItemPayload[]) =>
      almoxarifadoService.receberOcItens(ocId, itens),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs'] })
      qc.invalidateQueries({ queryKey: ['alm-oc', ocId] })
      qc.invalidateQueries({ queryKey: ['alm-estoque'] })
      qc.invalidateQueries({ queryKey: ['alm-movimentos'] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}

export function useCancelarOc(_obraId: number | undefined, ocId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.cancelarOc(ocId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs'] })
      qc.invalidateQueries({ queryKey: ['alm-oc', ocId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}
