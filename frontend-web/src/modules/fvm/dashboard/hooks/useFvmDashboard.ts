// frontend-web/src/modules/fvm/dashboard/hooks/useFvmDashboard.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvmService } from '@/services/fvm.service';
import type { FvmDashboardQuery } from '@/services/fvm.service';

export function useFvmDashboard(obraId: number, query?: FvmDashboardQuery) {
  return useQuery({
    queryKey: ['fvm-dashboard', obraId, query],
    queryFn:  () => fvmService.getDashboard(obraId, query),
    enabled:  !!obraId,
    staleTime: 60_000,
  });
}

export function useFvmPerformance(params?: { obra_id?: number; data_inicio?: string; data_fim?: string }) {
  return useQuery({
    queryKey: ['fvm-performance', params],
    queryFn:  () => fvmService.getPerformanceFornecedores(params),
    staleTime: 60_000,
  });
}

export function usePatchFornecedorScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score }: { id: number; score: number }) =>
      fvmService.patchFornecedorScore(id, score),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-performance'] });
      qc.invalidateQueries({ queryKey: ['fvm-fornecedores'] });
    },
  });
}

export function useFvmNcsRelatorio(
  obraId: number,
  params?: { data_inicio?: string; data_fim?: string; status?: string; criticidade?: string; fornecedor_id?: number },
) {
  return useQuery({
    queryKey: ['fvm-ncs-relatorio', obraId, params],
    queryFn:  () => fvmService.getNcsRelatorio(obraId, params),
    enabled:  !!obraId,
    staleTime: 30_000,
  });
}
