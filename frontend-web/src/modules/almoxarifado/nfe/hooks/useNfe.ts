// frontend-web/src/modules/almoxarifado/nfe/hooks/useNfe.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { almoxarifadoService } from '../../_service/almoxarifado.service'

export function useNfes(
  obraId: number,
  params?: { status?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['alm-nfes', obraId, params?.status],
    queryFn:  () => almoxarifadoService.getNfes(obraId, params),
    enabled:  obraId > 0,
  })
}

export function useNfe(id: number) {
  return useQuery({
    queryKey: ['alm-nfe', id],
    queryFn:  () => almoxarifadoService.getNfe(id),
    enabled:  id > 0,
  })
}

export function useAceitarNfe(obraId: number, nfeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload?: { oc_id?: number }) =>
      almoxarifadoService.aceitarNfe(nfeId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-nfes', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-nfe', nfeId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}

export function useRejeitarNfe(obraId: number, nfeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motivo: string) => almoxarifadoService.rejeitarNfe(nfeId, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-nfes', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-nfe', nfeId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}

export function useVincularOcNfe(nfeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (oc_id: number) => almoxarifadoService.vincularOcNfe(nfeId, oc_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-nfe', nfeId] })
    },
  })
}

export function useConfirmarMatchItem(nfeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, catalogo_id }: { itemId: number; catalogo_id: number }) =>
      almoxarifadoService.confirmarMatchItem(nfeId, itemId, catalogo_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-nfe', nfeId] })
    },
  })
}
