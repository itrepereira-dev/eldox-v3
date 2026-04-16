// frontend-web/src/modules/almoxarifado/compras/hooks/useCompras.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { almoxarifadoService } from '../../_service/almoxarifado.service'
import type { CreateOcPayload, ReceberOcItemPayload } from '../../_service/almoxarifado.service'

export function useOcs(
  obraId: number,
  params?: { status?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['alm-ocs', obraId, params?.status],
    queryFn:  () => almoxarifadoService.getOcs(obraId, params),
    enabled:  obraId > 0,
  })
}

export function useOc(id: number) {
  return useQuery({
    queryKey: ['alm-oc', id],
    queryFn:  () => almoxarifadoService.getOc(id),
    enabled:  id > 0,
  })
}

export function useCriarOc(obraId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOcPayload) =>
      almoxarifadoService.criarOc(obraId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}

export function useConfirmarOc(obraId: number, ocId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.confirmarOc(ocId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-oc', ocId] })
    },
  })
}

export function useEmitirOc(obraId: number, ocId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.emitirOc(ocId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-oc', ocId] })
    },
  })
}

export function useReceberOcItens(obraId: number, ocId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itens: ReceberOcItemPayload[]) =>
      almoxarifadoService.receberOcItens(obraId, ocId, itens),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-oc', ocId] })
      qc.invalidateQueries({ queryKey: ['alm-estoque', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-movimentos', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}

export function useCancelarOc(obraId: number, ocId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.cancelarOc(ocId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-ocs', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-oc', ocId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}
