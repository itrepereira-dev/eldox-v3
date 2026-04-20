// frontend-web/src/services/ncs.service.ts
import { api } from './api';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type NcCategoria = 'CONCRETAGEM' | 'FVS' | 'FVM' | 'ENSAIO' | 'GERAL';
export type NcCriticidade = 'ALTA' | 'MEDIA' | 'BAIXA';
export type NcStatus = 'ABERTA' | 'EM_ANALISE' | 'TRATAMENTO' | 'VERIFICACAO' | 'FECHADA' | 'CANCELADA';

export interface NaoConformidade {
  id: number;
  tenant_id: number;
  obra_id: number;
  numero: string;
  categoria: NcCategoria;
  criticidade: NcCriticidade;
  titulo: string;
  descricao: string | null;
  status: NcStatus;
  caminhao_id: number | null;
  cp_id: number | null;
  fvs_ficha_id: number | null;
  fvm_lote_id: number | null;
  ensaio_id: number | null;
  aberta_por: number;
  responsavel_id: number | null;
  prazo: string | null;
  data_fechamento: string | null;
  evidencia_url: string | null;
  observacoes: string | null;
  // Vinculação ao GED (nullable por compat com NCs antigas que usam evidencia_url)
  ged_versao_id: number | null;
  // Enriquecimento via LEFT JOIN no backend — presente quando ged_versao_id != null
  ged_codigo?: string | null;
  ged_titulo?: string | null;
  ged_versao_status?: string | null;
  ged_numero_revisao?: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListNcsParams {
  status?: NcStatus;
  categoria?: NcCategoria;
  criticidade?: NcCriticidade;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListNcsResponse {
  status: 'success';
  data: NaoConformidade[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateNcPayload {
  titulo: string;
  categoria?: NcCategoria;
  criticidade?: NcCriticidade;
  descricao?: string;
  responsavel_id?: number;
  prazo?: string;
  observacoes?: string;
  /** id de `ged_versoes` — documento rastreável do GED. */
  gedVersaoId?: number;
}

export interface UpdateNcPayload extends Partial<CreateNcPayload> {
  status?: NcStatus;
  evidencia_url?: string;
  data_fechamento?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const ncsService = {
  // Listar NCs de uma obra
  listarPorObra: (obraId: number, params: ListNcsParams = {}): Promise<ListNcsResponse> =>
    api.get(`/obras/${obraId}/ncs`, { params }).then((r) => r.data),

  // Listar NCs global (cross-obra)
  listarGlobal: (params: ListNcsParams = {}): Promise<ListNcsResponse> =>
    api.get('/ncs', { params }).then((r) => r.data),

  // Detalhe de uma NC
  buscar: (ncId: number): Promise<{ status: 'success'; data: NaoConformidade }> =>
    api.get(`/ncs/${ncId}`).then((r) => r.data),

  // Criar NC manual
  criar: (obraId: number, payload: CreateNcPayload): Promise<{ status: 'success'; data: NaoConformidade }> =>
    api.post(`/obras/${obraId}/ncs`, payload).then((r) => r.data),

  // Atualizar NC
  atualizar: (ncId: number, payload: UpdateNcPayload): Promise<{ status: 'success'; data: NaoConformidade }> =>
    api.patch(`/ncs/${ncId}`, payload).then((r) => r.data),

  // Soft delete
  deletar: (ncId: number): Promise<{ status: 'success'; data: { id: number; deleted: boolean } }> =>
    api.delete(`/ncs/${ncId}`).then((r) => r.data),

  // Upload de evidência (foto/PDF) direto na NC. Persiste no GED e
  // atualiza nao_conformidades.ged_versao_id + evidencia_url.
  uploadEvidencia: (
    ncId: number,
    file: File,
  ): Promise<{
    status: 'success';
    data: {
      ged_versao_id: number;
      ged_codigo: string;
      ged_titulo: string;
      storage_key: string;
      presigned_url: string;
    };
  }> => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post(`/ncs/${ncId}/evidencia/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};
