// frontend-web/src/modules/almoxarifado/solicitacao/hooks/useSolicitacao.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { almoxarifadoService } from '../../_service/almoxarifado.service'
import type {
  CreateSolicitacaoPayload,
  AprovarSolicitacaoPayload,
} from '../../_service/almoxarifado.service'

export function useSolicitacoes(
  obraId: number,
  params?: { status?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['alm-solicitacoes', obraId, params?.status],
    queryFn:  () => almoxarifadoService.getSolicitacoes(obraId, params),
    enabled:  obraId > 0,
  })
}

export function useSolicitacao(id: number) {
  return useQuery({
    queryKey: ['alm-solicitacao', id],
    queryFn:  () => almoxarifadoService.getSolicitacao(id),
    enabled:  id > 0,
  })
}

export function useCriarSolicitacao(obraId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSolicitacaoPayload) =>
      almoxarifadoService.criarSolicitacao(obraId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}

export function useSubmeterSolicitacao(obraId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.submeterSolicitacao(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-solicitacao', id] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}

export function useAprovarSolicitacao(obraId: number, solicitacaoId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AprovarSolicitacaoPayload) =>
      almoxarifadoService.aprovarSolicitacao(solicitacaoId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-solicitacao', solicitacaoId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}

export function useCancelarSolicitacao(obraId: number, solicitacaoId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.cancelarSolicitacao(solicitacaoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes', obraId] })
      qc.invalidateQueries({ queryKey: ['alm-solicitacao', solicitacaoId] })
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] })
    },
  })
}
