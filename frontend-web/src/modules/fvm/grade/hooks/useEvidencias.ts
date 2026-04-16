// frontend-web/src/modules/fvm/grade/hooks/useEvidencias.ts
// Hooks TanStack Query para evidências (documentos vinculados) de um lote FVM

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { GedStatus } from '@/services/ged.service';
import { gedService } from '@/services/ged.service';
import type { GedUploadResult } from '@/services/ged.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

// Valores lowercase — alinhados com o enum do backend (TipoEvidencia DTO)
export type TipoEvidencia =
  | 'nf'
  | 'certificado'
  | 'laudo'
  | 'foto'
  | 'ficha_tecnica'
  | 'outro';

export interface EvidenciaLote {
  id: number;
  lote_id: number;
  ged_versao_id: number;
  tipo: TipoEvidencia;
  descricao: string | null;
  criado_em: string;
  // campos expandidos do GED
  ged_titulo: string;
  ged_codigo: string;
  ged_status: GedStatus;
  ged_mime_type: string;
  ged_nome_original: string;
  ged_tamanho_bytes: number;
  download_url: string | null;
  download_expires_in: number | null;
}

export interface VincularEvidenciaPayload {
  ged_versao_id: number;
  tipo: TipoEvidencia;
  descricao?: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Lista as evidências de um lote, incluindo download_url pré-assinada */
export function useEvidencias(loteId: number) {
  return useQuery<EvidenciaLote[]>({
    queryKey: ['fvm-evidencias', loteId],
    queryFn: async () => {
      const { data } = await api.get(`/fvm/lotes/${loteId}/evidencias`);
      return data.data ?? data;
    },
    enabled: !!loteId,
    staleTime: 4 * 60_000, // URLs expiram em 5 min — refetch antes
    refetchInterval: 4 * 60_000,
  });
}

/** Vincula uma versão GED já enviada ao lote */
export function useVincularEvidencia(loteId: number) {
  const qc = useQueryClient();
  return useMutation<EvidenciaLote, Error, VincularEvidenciaPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post(`/fvm/lotes/${loteId}/evidencias`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-evidencias', loteId] });
    },
  });
}

/** Remove o vínculo de uma evidência ao lote (não exclui o documento do GED) */
export function useDesvincularEvidencia(loteId: number) {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (evidenciaId) => {
      await api.delete(`/fvm/evidencias/${evidenciaId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-evidencias', loteId] });
    },
  });
}

/** Envia um arquivo para o GED da obra e retorna o versaoId */
export function useUploadGed(obraId: number) {
  return useMutation<GedUploadResult & { _progress?: number }, Error, {
    formData: FormData;
    onProgress?: (pct: number) => void;
  }>({
    mutationFn: ({ formData, onProgress }) =>
      gedService.upload(obraId, formData, onProgress),
  });
}

/** Busca a URL de download pré-assinada para uma versão GED específica (para preview) */
export function useDownloadUrl(versaoId: number | null) {
  return useQuery({
    queryKey: ['ged-download-url', versaoId],
    queryFn: () => gedService.download(versaoId!),
    enabled: !!versaoId,
    staleTime: 4 * 60_000,
    refetchInterval: 4 * 60_000,
  });
}
