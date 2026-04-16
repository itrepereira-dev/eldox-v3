// frontend-web/src/modules/concretagem/betonadas/hooks/useBetonadas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  concretagemService,
  type ListBetonadasParams,
  type CreateBetonadaPayload,
  type UpdateBetonadaPayload,
  type CreateCaminhaoPayload,
  type RegistrarSlumpPayload,
  type CreateCpPayload,
  type RegistrarRupturaPayload,
  type PatchCaminhaoPayload,
  type OcrNfPayload,
} from '@/services/concretagem.service';

// ── Betonadas ─────────────────────────────────────────────────────────────────

export function useListarBetonadas(obraId: number, params?: ListBetonadasParams) {
  return useQuery({
    queryKey: ['betonadas', obraId, params],
    queryFn: () => concretagemService.listarBetonadas(obraId, params),
    staleTime: 30_000,
    enabled: !!obraId,
  });
}

export function useBuscarBetonada(obraId: number, id: number) {
  return useQuery({
    queryKey: ['betonada', obraId, id],
    queryFn: () => concretagemService.buscarBetonada(obraId, id),
    staleTime: 30_000,
    enabled: !!obraId && !!id,
  });
}

export function useCriarBetonada(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBetonadaPayload) =>
      concretagemService.criarBetonada(obraId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonadas', obraId] });
    },
  });
}

export function useAtualizarBetonada(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateBetonadaPayload }) =>
      concretagemService.atualizarBetonada(obraId, id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['betonadas', obraId] });
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, id] });
    },
  });
}

export function useCancelarBetonada(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => concretagemService.cancelarBetonada(obraId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonadas', obraId] });
    },
  });
}

// ── Caminhões ─────────────────────────────────────────────────────────────────

export function useRegistrarCaminhao(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCaminhaoPayload) =>
      concretagemService.registrarCaminhao(betonadaId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

export function useRegistrarSlump(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminhaoId, payload }: { caminhaoId: number; payload: RegistrarSlumpPayload }) =>
      concretagemService.registrarSlump(caminhaoId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

export function useConcluirCaminhao(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caminhaoId: number) => concretagemService.concluirCaminhao(caminhaoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

// ── Corpos de Prova ───────────────────────────────────────────────────────────

export function useMoldagemCp(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCpPayload) =>
      concretagemService.moldagemCp(betonadaId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

export function useRegistrarRuptura(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cpId, payload }: { cpId: number; payload: RegistrarRupturaPayload }) =>
      concretagemService.registrarRuptura(cpId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

export function useRejeitarCaminhao(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminhaoId, motivo }: { caminhaoId: number; motivo: string }) =>
      concretagemService.rejeitarCaminhao(caminhaoId, motivo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

export function useToggleLiberado(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => concretagemService.toggleLiberadoCarregamento(obraId, betonadaId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

export function usePatchCaminhao(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminhaoId, payload }: { caminhaoId: number; payload: PatchCaminhaoPayload }) =>
      concretagemService.patchCaminhao(caminhaoId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

export function useSetLacre(obraId: number, betonadaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminhaoId, aprovado }: { caminhaoId: number; aprovado: boolean }) =>
      concretagemService.setLacre(caminhaoId, aprovado),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['betonada', obraId, betonadaId] });
    },
  });
}

export function useOcrNf() {
  return useMutation({
    mutationFn: (payload: OcrNfPayload) =>
      concretagemService.ocrNf(payload),
  });
}
