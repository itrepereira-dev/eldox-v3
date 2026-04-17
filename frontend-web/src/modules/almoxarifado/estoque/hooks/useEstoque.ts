// frontend-web/src/modules/almoxarifado/estoque/hooks/useEstoque.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { almoxarifadoService } from '../../_service/almoxarifado.service';
import type { CreateMovimentoPayload } from '../../_service/almoxarifado.service';

// ── Saldo ─────────────────────────────────────────────────────────────────────

export function useSaldoEstoque(
  _obraId?: number,
  params?: { localId?: number; catalogoId?: number; nivel?: string },
) {
  return useQuery({
    queryKey: ['alm-estoque', _obraId, params],
    queryFn:  () => almoxarifadoService.getSaldo(params),
    staleTime: 30_000,
  });
}

// ── Movimentos ────────────────────────────────────────────────────────────────

export function useMovimentos(
  _obraId?: number,
  params?: { catalogoId?: number; tipo?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['alm-movimentos', _obraId, params],
    queryFn:  () => almoxarifadoService.getMovimentos(params),
    staleTime: 30_000,
  });
}

export function useRegistrarMovimento(_localId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMovimentoPayload) =>
      almoxarifadoService.registrarMovimento(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-estoque'] });
      qc.invalidateQueries({ queryKey: ['alm-movimentos'] });
      qc.invalidateQueries({ queryKey: ['alm-alertas'] });
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] });
    },
  });
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export function useAlertas(_obraId?: number, todos = false) {
  return useQuery({
    queryKey: ['alm-alertas', _obraId, todos],
    queryFn:  () => almoxarifadoService.getAlertas({ todos }),
    staleTime: 60_000,
  });
}

export function useMarcarAlertaLido(_obraId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertaId: number) => almoxarifadoService.marcarAlertaLido(alertaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-alertas'] });
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] });
    },
  });
}

export function useMarcarTodosLidos(_obraId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => almoxarifadoService.marcarTodosLidos(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-alertas'] });
      qc.invalidateQueries({ queryKey: ['alm-dashboard'] });
    },
  });
}

// ── Locais ────────────────────────────────────────────────────────────────────

export function useLocaisEstoque(_obraId?: number) {
  return useQuery({
    queryKey: ['alm-locais'],
    queryFn:  () => almoxarifadoService.listarLocais({ ativo: true }),
    staleTime: 5 * 60_000,
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function useAlmDashboardKpis(_obraId?: number) {
  return useQuery({
    queryKey: ['alm-dashboard', _obraId],
    queryFn:  () => almoxarifadoService.getDashboardKpis(),
    staleTime: 60_000,
  });
}
