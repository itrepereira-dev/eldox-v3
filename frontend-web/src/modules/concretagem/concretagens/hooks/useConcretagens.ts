// frontend-web/src/modules/concretagem/concretagens/hooks/useConcretagens.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  concretagemService,
  type ListConcrtagensParams,
  type CreateConcrtagemPayload,
  type UpdateConcrtagemPayload,
  type CreateCaminhaoPayload,
  type RegistrarSlumpPayload,
  type CreateCpPayload,
  type RegistrarRupturaPayload,
  type PatchCaminhaoPayload,
  type OcrNfPayload,
} from '@/services/concretagem.service';

// ── Concretagens ──────────────────────────────────────────────────────────────

export function useListarConcretagens(obraId: number, params?: ListConcrtagensParams) {
  return useQuery({
    queryKey: ['concretagens', obraId, params],
    queryFn: () => concretagemService.listarConcretagens(obraId, params),
    staleTime: 30_000,
    enabled: !!obraId,
  });
}

export function useBuscarConcretagem(obraId: number, id: number) {
  return useQuery({
    queryKey: ['concretagem', obraId, id],
    queryFn: () => concretagemService.buscarConcretagem(obraId, id),
    staleTime: 30_000,
    enabled: !!obraId && !!id,
  });
}

export function useCriarConcretagem(obraIdDefault?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obraId, payload }: { obraId: number; payload: CreateConcrtagemPayload }) =>
      concretagemService.criarConcretagem(obraId, payload),
    onSuccess: (_data, { obraId }) => {
      void qc.invalidateQueries({ queryKey: ['concretagens', obraId] });
      if (obraIdDefault && obraIdDefault !== obraId) {
        void qc.invalidateQueries({ queryKey: ['concretagens', obraIdDefault] });
      }
    },
  });
}

export function useAtualizarConcretagem(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateConcrtagemPayload }) =>
      concretagemService.atualizarConcretagem(obraId, id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['concretagens', obraId] });
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, id] });
    },
  });
}

export function useCancelarConcretagem(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => concretagemService.cancelarConcretagem(obraId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagens', obraId] });
    },
  });
}

// ── Caminhões ─────────────────────────────────────────────────────────────────

export function useRegistrarCaminhao(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCaminhaoPayload) =>
      concretagemService.registrarCaminhao(concrtagemId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

export function useRegistrarSlump(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminhaoId, payload }: { caminhaoId: number; payload: RegistrarSlumpPayload }) =>
      concretagemService.registrarSlump(caminhaoId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

export function useConcluirCaminhao(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caminhaoId: number) => concretagemService.concluirCaminhao(caminhaoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

// ── Corpos de Prova ───────────────────────────────────────────────────────────

export function useMoldagemCp(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCpPayload) =>
      concretagemService.moldagemCp(concrtagemId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

export function useRegistrarRuptura(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cpId, payload }: { cpId: number; payload: RegistrarRupturaPayload }) =>
      concretagemService.registrarRuptura(cpId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

export function useRejeitarCaminhao(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminhaoId, motivo }: { caminhaoId: number; motivo: string }) =>
      concretagemService.rejeitarCaminhao(caminhaoId, motivo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

export function useToggleLiberado(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => concretagemService.toggleLiberadoCarregamento(obraId, concrtagemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

export function usePatchCaminhao(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminhaoId, payload }: { caminhaoId: number; payload: PatchCaminhaoPayload }) =>
      concretagemService.patchCaminhao(caminhaoId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

export function useSetLacre(obraId: number, concrtagemId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caminhaoId, aprovado }: { caminhaoId: number; aprovado: boolean }) =>
      concretagemService.setLacre(caminhaoId, aprovado),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagem', obraId, concrtagemId] });
    },
  });
}

export function useOcrNf() {
  return useMutation({
    mutationFn: (payload: OcrNfPayload) =>
      concretagemService.ocrNf(payload),
  });
}
