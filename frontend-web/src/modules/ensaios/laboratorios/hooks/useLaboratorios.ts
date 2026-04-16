// frontend-web/src/modules/ensaios/laboratorios/hooks/useLaboratorios.ts
// TanStack Query hooks para Laboratórios — SPEC 2

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ensaiosService, type Laboratorio } from '@/services/ensaios.service';

const KEY = ['laboratorios'] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export function useListarLaboratorios() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => ensaiosService.listarLaboratorios(),
    staleTime: 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCriarLaboratorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Laboratorio, 'id' | 'tenant_id' | 'created_at'>) =>
      ensaiosService.criarLaboratorio(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useToggleLaboratorioAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ensaiosService.toggleLaboratorioAtivo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
