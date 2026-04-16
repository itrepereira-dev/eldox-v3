// frontend-web/src/modules/almoxarifado/planejamento/hooks/usePlanejamento.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { almoxarifadoService } from '../../_service/almoxarifado.service'

export function usePlanejamento(obraId: number, mes?: number, ano?: number) {
  return useQuery({
    queryKey: ['alm-planejamento', obraId, mes, ano],
    queryFn:  () => almoxarifadoService.getPlanejamento(obraId, mes, ano),
    enabled:  obraId > 0,
  })
}

export function usePlanejamentoPeriodos(obraId: number) {
  return useQuery({
    queryKey: ['alm-planejamento-periodos', obraId],
    queryFn:  () => almoxarifadoService.getPlanejamentoPeriodos(obraId),
    enabled:  obraId > 0,
  })
}

export function useUpsertPlanejamento(obraId: number, mes: number, ano: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { catalogo_id: number; mes: number; ano: number; quantidade: number; observacao?: string }) =>
      almoxarifadoService.upsertPlanejamento(obraId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-planejamento', obraId, mes, ano] })
      qc.invalidateQueries({ queryKey: ['alm-planejamento-periodos', obraId] })
    },
  })
}

export function useRemoverPlanejamentoItem(obraId: number, mes: number, ano: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.removerPlanejamentoItem(obraId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-planejamento', obraId, mes, ano] })
      qc.invalidateQueries({ queryKey: ['alm-planejamento-periodos', obraId] })
    },
  })
}
