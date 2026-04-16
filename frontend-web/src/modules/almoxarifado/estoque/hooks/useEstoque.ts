// frontend-web/src/modules/almoxarifado/estoque/hooks/useEstoque.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { almoxarifadoService } from '../../_service/almoxarifado.service';
import type {
  CreateMovimentoPayload,
  TransferenciaPayload,
} from '../../_service/almoxarifado.service';

// ── Saldo ─────────────────────────────────────────────────────────────────────

export function useSaldoEstoque(
  obraId: number,
  params?: { localId?: number; catalogoId?: number; nivel?: string },
) {
  return useQuery({
    queryKey: ['alm-estoque', obraId, params],
    queryFn:  () => almoxarifadoService.getSaldo(obraId, params),
    enabled:  !!obraId,
    staleTime: 30_000,
  });
}

// ── Movimentos ────────────────────────────────────────────────────────────────

export function useMovimentos(
  obraId: number,
  params?: { catalogoId?: number; tipo?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['alm-movimentos', obraId, params],
    queryFn:  () => almoxarifadoService.getMovimentos(obraId, params),
    enabled:  !!obraId,
    staleTime: 30_000,
  });
}

export function useRegistrarMovimento(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMovimentoPayload) =>
      almoxarifadoService.registrarMovimento(obraId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-estoque',   obraId] });
      qc.invalidateQueries({ queryKey: ['alm-movimentos', obraId] });
      qc.invalidateQueries({ queryKey: ['alm-alertas',   obraId] });
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] });
    },
  });
}

export function useTransferencia(obraOrigemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransferenciaPayload) =>
      almoxarifadoService.transferir(obraOrigemId, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['alm-estoque',   obraOrigemId] });
      qc.invalidateQueries({ queryKey: ['alm-estoque',   vars.obra_destino_id] });
      qc.invalidateQueries({ queryKey: ['alm-movimentos', obraOrigemId] });
    },
  });
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export function useAlertas(obraId: number, todos = false) {
  return useQuery({
    queryKey: ['alm-alertas', obraId, todos],
    queryFn:  () => almoxarifadoService.getAlertas(obraId, todos),
    enabled:  !!obraId,
    staleTime: 60_000,
  });
}

export function useMarcarAlertaLido(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertaId: number) => almoxarifadoService.marcarAlertaLido(alertaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-alertas',   obraId] });
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] });
    },
  });
}

export function useMarcarTodosLidos(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => almoxarifadoService.marcarTodosLidos(obraId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alm-alertas',   obraId] });
      qc.invalidateQueries({ queryKey: ['alm-dashboard', obraId] });
    },
  });
}

// ── Locais ────────────────────────────────────────────────────────────────────

export function useLocaisEstoque(obraId: number) {
  return useQuery({
    queryKey: ['alm-locais', obraId],
    queryFn:  () => almoxarifadoService.getLocais(obraId),
    enabled:  !!obraId,
    staleTime: 5 * 60_000,
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function useAlmDashboardKpis(obraId: number) {
  return useQuery({
    queryKey: ['alm-dashboard', obraId],
    queryFn:  () => almoxarifadoService.getDashboardKpis(obraId),
    enabled:  !!obraId,
    staleTime: 60_000,
  });
}
