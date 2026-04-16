// frontend-web/src/modules/fvm/grade/hooks/useGradeFvm.ts
// Hooks TanStack Query para o módulo FVM — espelho dos hooks do FVS

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvmService } from '@/services/fvm.service';
import type {
  CreateLotePayload,
  ConcluirInspecaoPayload,
  PutRegistroPayload,
} from '@/services/fvm.service';

// ── Grade ─────────────────────────────────────────────────────────────────

export function useGradeFvm(obraId: number) {
  return useQuery({
    queryKey: ['fvm-grade', obraId],
    queryFn:  () => fvmService.getGrade(obraId),
    enabled:  !!obraId,
    staleTime: 30_000,
  });
}

export function useLotePreview(loteId: number) {
  return useQuery({
    queryKey: ['fvm-lote-preview', loteId],
    queryFn:  () => fvmService.getLotePreview(loteId),
    enabled:  !!loteId,
  });
}

// ── Lote / Ficha ──────────────────────────────────────────────────────────

export function useLote(loteId: number) {
  return useQuery({
    queryKey: ['fvm-lote', loteId],
    queryFn:  () => fvmService.getLote(loteId),
    enabled:  !!loteId,
  });
}

export function useCreateLote(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLotePayload) => fvmService.createLote(obraId, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['fvm-grade', obraId] }),
  });
}

export function usePutRegistro(loteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PutRegistroPayload) => fvmService.putRegistro(loteId, payload),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['fvm-lote', loteId] });
      qc.invalidateQueries({ queryKey: ['fvm-lote-preview', loteId] });
    },
  });
}

export function useConcluirInspecao(loteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConcluirInspecaoPayload) => fvmService.concluirInspecao(loteId, payload),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['fvm-lote', loteId] });
      qc.invalidateQueries({ queryKey: ['fvm-lote-preview', loteId] });
      // Invalida a grade da obra para atualizar a célula
      qc.invalidateQueries({ queryKey: ['fvm-grade'] });
    },
  });
}

// ── Catálogo ──────────────────────────────────────────────────────────────

export function useMateriais(categoriaId?: number) {
  return useQuery({
    queryKey: ['fvm-materiais', categoriaId],
    queryFn:  () => fvmService.getMateriais(categoriaId),
    staleTime: 5 * 60_000, // catálogo muda pouco
  });
}

export function useCategoriasMateriais() {
  return useQuery({
    queryKey: ['fvm-categorias'],
    queryFn:  () => fvmService.getCategorias(),
    staleTime: 5 * 60_000,
  });
}

// ── Fornecedores ──────────────────────────────────────────────────────────

export function useFornecedores() {
  return useQuery({
    queryKey: ['fvm-fornecedores'],
    queryFn:  () => fvmService.getFornecedores(),
    staleTime: 60_000,
  });
}

export function useCreateFornecedorRapido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fvmService.createFornecedorRapido,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['fvm-fornecedores'] }),
  });
}

// ── Ensaios ──────────────────────────────────────────────────────────────────

export function useEnsaioTemplates(materialId: number) {
  return useQuery({
    queryKey: ['fvm-ensaio-templates', materialId],
    queryFn:  () => fvmService.getEnsaioTemplates(materialId),
    enabled:  !!materialId,
    staleTime: 300_000, // templates are stable
  });
}

export function useEnsaios(loteId: number) {
  return useQuery({
    queryKey: ['fvm-ensaios', loteId],
    queryFn:  () => fvmService.listarEnsaios(loteId),
    enabled:  !!loteId,
    staleTime: 10_000,
  });
}

export function useResultadoEnsaios(loteId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['fvm-ensaios-resultado', loteId],
    queryFn:  () => fvmService.getResultadoEnsaiosLote(loteId),
    enabled:  enabled && !!loteId,
    staleTime: 10_000,
  });
}

export function useRegistrarEnsaio(loteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: import('@/services/fvm.service').RegistrarEnsaioPayload) =>
      fvmService.registrarEnsaio(loteId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-ensaios', loteId] });
      qc.invalidateQueries({ queryKey: ['fvm-ensaios-resultado', loteId] });
    },
  });
}

export function useAtualizarEnsaio(loteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ensaioId, payload }: { ensaioId: number; payload: Partial<import('@/services/fvm.service').RegistrarEnsaioPayload> }) =>
      fvmService.atualizarEnsaio(ensaioId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-ensaios', loteId] });
      qc.invalidateQueries({ queryKey: ['fvm-ensaios-resultado', loteId] });
    },
  });
}

export function useRemoverEnsaio(loteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ensaioId: number) => fvmService.removerEnsaio(ensaioId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-ensaios', loteId] });
      qc.invalidateQueries({ queryKey: ['fvm-ensaios-resultado', loteId] });
    },
  });
}
