import { api } from './api';

// ─── Enums / Literais ───────────────────────────────────────────────────────

export type GedStatus =
  | 'RASCUNHO'
  | 'IFA'
  | 'IFC'
  | 'IFP'
  | 'AS_BUILT'
  | 'REJEITADO'
  | 'OBSOLETO'
  | 'CANCELADO';

export type GedEscopo = 'OBRA' | 'EMPRESA';

export type GedDisciplina = 'ARQ' | 'EST' | 'HID' | 'ELE' | 'MEC' | 'GEO';

// ─── Tipos de domínio ────────────────────────────────────────────────────────

export interface GedCategoria {
  id: number;
  nome: string;
  codigo: string;
  escopoPadrao: GedEscopo;
  requerAprovacao: boolean;
}

export interface GedPasta {
  id: number;
  tenantId: number;
  escopoPasta: GedEscopo;
  obraId?: number;
  parentId?: number;
  nome: string;
  path: string;
  nivel: number;
  configuracoes: Record<string, unknown>;
  settingsEfetivos: Record<string, unknown>;
}

export interface GedVersaoResumo {
  id: number;
  numeroRevisao: string;
  version: number;
  status: GedStatus;
  aprovadoEm?: string;
  aprovadoPor?: number;
  tamanhoBytes: number;
  mimeType: string;
  dataValidade?: string;
}

export interface GedDocumento {
  id: number;
  titulo: string;
  codigo: string;
  disciplina?: GedDisciplina;
  escopo: GedEscopo;
  obraId?: number;
  pastaId: number;
  categoriaId: number;
  categoria: GedCategoria;
  versaoAtual: GedVersaoResumo;
  obraLocal?: { id: number; nome: string };
  tags?: string[];
}

export interface GedVersaoDetalhe extends GedVersaoResumo {
  documentoId: number;
  // `titulo` e `codigo` vêm do documento-pai (ged.service.ts getVersaoDetalhe
  // no backend faz JOIN ged_documentos). Incluídos aqui para consumidores
  // como GedDocSelector não precisarem fazer cast leve.
  titulo: string;
  codigo: string;
  storageKey: string;
  nomeOriginal: string;
  ocrTexto?: string;
  aiCategorias?: string[];
  aiConfianca?: number;
  comentarioRejeicao?: string;
  workflowTemplateId?: number;
  qrToken: string;
}

export interface GedListaMestraItem {
  codigo: string;
  titulo: string;
  numeroRevisao: string;
  aprovadoEm: string;
  aprovadoPor: string;
  dataValidade?: string;
  alertaVencimento: boolean;
}

export interface GedAuditEntry {
  id: number;
  acao: string;
  statusDe?: string;
  statusPara?: string;
  ipOrigem?: string;
  detalhes?: Record<string, unknown>;
  criadoEm: string;
  usuarioId?: number;
}

export interface GedListarParams {
  status?: GedStatus;
  categoriaId?: number;
  pastaId?: number;
  disciplina?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface GedListarResult {
  items: GedDocumento[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GedUploadResult {
  documentoId: number;
  versaoId: number;
  codigoGerado: string;
  status: GedStatus;
  qrToken: string;
}

export interface GedDownloadResult {
  presignedUrl: string;
  nomeOriginal: string;
  expiresInSeconds: number;
}

export interface GedStatusResult {
  versaoId: number;
  status: GedStatus;
}

export interface GedAprovarPayload {
  statusAprovado: 'IFC' | 'IFP' | 'AS_BUILT';
  comentario?: string;
}

export interface GedRejeitarPayload {
  comentario: string;
}

export interface GedListaMestraResult {
  obra: { id: number; nome: string };
  modoAuditoria: boolean;
  geradoEm: string;
  categorias: {
    codigo: string;
    nome: string;
    documentos: GedListaMestraItem[];
  }[];
}

export interface GedCriarPastaPayload {
  nome: string;
  parentId?: number;
  escopoPasta?: GedEscopo;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const gedService = {
  // Categorias
  async getCategorias(obraId: number): Promise<GedCategoria[]> {
    const { data } = await api.get(`/obras/${obraId}/ged/categorias`);
    return data.data ?? data;
  },

  // Categorias empresa (sem obra)
  async getCategoriasEmpresa(): Promise<GedCategoria[]> {
    const { data } = await api.get('/ged/categorias');
    return data.data ?? data;
  },

  // Pastas
  async getPastas(obraId: number): Promise<GedPasta[]> {
    const { data } = await api.get(`/obras/${obraId}/ged/pastas`);
    return data.data ?? data;
  },

  // Pastas empresa (escopo EMPRESA, obra_id NULL)
  async getPastasEmpresa(): Promise<GedPasta[]> {
    const { data } = await api.get('/ged/pastas');
    return data.data ?? data;
  },

  async criarPasta(obraId: number, payload: GedCriarPastaPayload): Promise<GedPasta> {
    const { data } = await api.post(`/obras/${obraId}/ged/pastas`, payload);
    return data.data ?? data;
  },

  // Documentos — listar
  async listar(obraId: number, params?: GedListarParams): Promise<GedListarResult> {
    const { data } = await api.get(`/obras/${obraId}/ged/documentos`, { params });
    return data.data ?? data;
  },

  // Documentos empresa (sem obra)
  async listarEmpresa(params?: GedListarParams): Promise<GedListarResult> {
    const { data } = await api.get('/ged/documentos', { params });
    return data.data ?? data;
  },

  // Upload
  async upload(
    obraId: number,
    formData: FormData,
    onProgress?: (pct: number) => void,
  ): Promise<GedUploadResult> {
    const { data } = await api.post(`/obras/${obraId}/ged/documentos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return data.data ?? data;
  },

  // Upload empresa (sem obra — POST /ged/documentos). A pasta e a categoria
  // no FormData devem ser de escopo EMPRESA.
  async uploadEmpresa(
    formData: FormData,
    onProgress?: (pct: number) => void,
  ): Promise<GedUploadResult> {
    // Garante escopo EMPRESA mesmo se o FormData não trouxer.
    if (!formData.has('escopo')) formData.append('escopo', 'EMPRESA');
    const { data } = await api.post('/ged/documentos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return data.data ?? data;
  },

  // Versão detalhe
  async getVersaoDetalhe(versaoId: number): Promise<GedVersaoDetalhe> {
    const { data } = await api.get(`/ged/versoes/${versaoId}`);
    return data.data ?? data;
  },

  // Audit log
  async getAuditLog(versaoId: number): Promise<GedAuditEntry[]> {
    const { data } = await api.get(`/ged/versoes/${versaoId}/audit`);
    return data.data ?? data;
  },

  // Download pré-assinado
  async download(versaoId: number): Promise<GedDownloadResult> {
    const { data } = await api.get(`/ged/versoes/${versaoId}/download`);
    return data.data ?? data;
  },

  // Submeter para revisão
  async submeter(versaoId: number): Promise<GedStatusResult> {
    const { data } = await api.post(`/ged/versoes/${versaoId}/submeter`);
    return data.data ?? data;
  },

  // Aprovar
  async aprovar(versaoId: number, payload: GedAprovarPayload): Promise<GedStatusResult> {
    const { data } = await api.post(`/ged/versoes/${versaoId}/aprovar`, payload);
    return data.data ?? data;
  },

  // Rejeitar
  async rejeitar(versaoId: number, payload: GedRejeitarPayload): Promise<GedStatusResult> {
    const { data } = await api.post(`/ged/versoes/${versaoId}/rejeitar`, payload);
    return data.data ?? data;
  },

  // Lista mestra
  async getListaMestra(obraId: number): Promise<GedListaMestraResult> {
    const { data } = await api.get(`/obras/${obraId}/ged/lista-mestra`);
    return data.data ?? data;
  },

  // Stats resumidas
  async getStats(obraId: number): Promise<{
    total: number;
    vigentes: number;
    vencendo30dias: number;
  }> {
    const { data } = await api.get(`/obras/${obraId}/ged/stats`);
    return data.data ?? data;
  },
};
