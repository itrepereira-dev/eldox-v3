// frontend-web/src/modules/almoxarifado/nfe/hooks/useNfe.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { almoxarifadoService } from '../../_service/almoxarifado.service'
export function useNfes(
  _obraId?: number,
  params?: { status?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['alm-nfes', _obraId, params?.status],
    queryFn:  () => almoxarifadoService.getNfes(params),
    enabled:  true,
  })
}

export function useNfe(id: number) {
  return useQuery({
    queryKey: ['alm-nfe', id],
    queryFn:  () => almoxarifadoService.getNfe(id),
    enabled:  id > 0,
  })
}

export function useAceitarNfe(_obraId: number | undefined, nfeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { local_id: number; oc_id?: number; observacao?: string }) =>
      almoxarifadoService.aceitarNfe(nfeId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-nfes'] })
      qc.invalidateQueries({ queryKey: ['alm-nfe', nfeId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}

export function useRejeitarNfe(_obraId: number | undefined, nfeId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motivo: string) => almoxarifadoService.rejeitarNfe(nfeId, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-nfes'] })
      qc.invalidateQueries({ queryKey: ['alm-nfe', nfeId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
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

export function useUploadNfeXml() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => almoxarifadoService.uploadNfeXml(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-nfes'] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}
