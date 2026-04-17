// frontend-web/src/modules/almoxarifado/solicitacao/hooks/useSolicitacao.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { almoxarifadoService } from '../../_service/almoxarifado.service'
import type {
  CreateSolicitacaoPayload,
  AprovarSolicitacaoPayload,
} from '../../_service/almoxarifado.service'

export function useSolicitacoes(
  _obraId?: number,
  params?: { status?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['alm-solicitacoes', _obraId, params?.status],
    queryFn:  () => almoxarifadoService.getSolicitacoes(params),
    enabled:  true,
  })
}

export function useSolicitacao(id: number) {
  return useQuery({
    queryKey: ['alm-solicitacao', id],
    queryFn:  () => almoxarifadoService.getSolicitacao(id),
    enabled:  id > 0,
  })
}

export function useCriarSolicitacao(_obraId?: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSolicitacaoPayload) =>
      almoxarifadoService.criarSolicitacao(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}

export function useSubmeterSolicitacao(_obraId?: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.submeterSolicitacao(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['alm-solicitacao', id] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}

export function useAprovarSolicitacao(_obraId: number | undefined, solicitacaoId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AprovarSolicitacaoPayload) =>
      almoxarifadoService.aprovarSolicitacao(solicitacaoId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['alm-solicitacao', solicitacaoId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}

export function useCancelarSolicitacao(_obraId: number | undefined, solicitacaoId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.cancelarSolicitacao(solicitacaoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['alm-solicitacao', solicitacaoId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] })
    },
  })
}
