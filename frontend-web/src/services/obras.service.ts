import { api } from './api';

export interface ObraTipoNivel {
  numero: number;
  labelSingular: string;
  labelPlural: string;
  geracaoEmMassa: boolean;
  prefixoPadrao?: string;
}

export interface ObraTipo {
  id: number;
  tenantId: number;
  nome: string;
  slug: string;
  descricao?: string;
  totalNiveis: number;
  niveis: ObraTipoNivel[];
}

export interface Obra {
  id: number;
  nome: string;
  codigo: string;
  modoQualidade: 'SIMPLES' | 'PBQPH';
  status: 'PLANEJAMENTO' | 'EM_EXECUCAO' | 'PARALISADA' | 'CONCLUIDA' | 'ENTREGUE';
  cidade?: string;
  estado?: string;
  dataInicioPrevista?: string;
  dataFimPrevista?: string;
  totalLocais: number;
  criadoEm: string;
  obraTipo: { id: number; nome: string; slug: string };
}

export interface ObraDetalhe extends Obra {
  endereco?: string;
  cep?: string;
  dadosExtras?: Record<string, unknown>;
  niveisConfig: { nivel: number; labelSingular: string; labelPlural: string }[];
}

export interface ObraLocal {
  id: number;
  obraId: number;
  parentId?: number;
  nivel: number;
  nome: string;
  codigo: string;
  nomeCompleto: string;
  status: string;
  ordem: number;
  totalFilhos: number;
  dataInicioPrevista?: string;
  dataFimPrevista?: string;
}

export interface CreateObraPayload {
  nome: string;
  obraTipoId: number;
  modoQualidade?: 'SIMPLES' | 'PBQPH';
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  dataInicioPrevista?: string;
  dataFimPrevista?: string;
}

export interface CreateLocalPayload {
  parentId?: number;
  nivel: number;
  nome: string;
  ordem?: number;
  dataInicioPrevista?: string;
  dataFimPrevista?: string;
}

export interface GerarMassaPayload {
  parentId?: number;
  nivel: number;
  prefixo: string;
  quantidade: number;
  inicioEm?: number;
}

export const obrasService = {
  // Tipos
  async getTipos(): Promise<ObraTipo[]> {
    const { data } = await api.get('/obra-tipos');
    return data.data ?? data;
  },

  // Obras CRUD
  async getAll(params?: { status?: string; page?: number; limit?: number }) {
    const { data } = await api.get('/obras', { params });
    return data.data ?? data;
  },

  async getById(id: number): Promise<ObraDetalhe> {
    const { data } = await api.get(`/obras/${id}`);
    return data.data ?? data;
  },

  async create(payload: CreateObraPayload): Promise<{ obra: Obra; proximaEtapa: string }> {
    const { data } = await api.post('/obras', payload);
    return data.data ?? data;
  },

  async update(id: number, payload: Partial<CreateObraPayload & { status: string }>) {
    const { data } = await api.put(`/obras/${id}`, payload);
    return data.data ?? data;
  },

  async remove(id: number) {
    const { data } = await api.delete(`/obras/${id}`);
    return data.data ?? data;
  },

  // Locais
  async getLocais(obraId: number, params?: { parentId?: number | null; nivel?: number }) {
    const query: Record<string, string> = {};
    if (params?.parentId !== undefined)
      query.parentId = params.parentId === null ? 'null' : String(params.parentId);
    if (params?.nivel !== undefined)
      query.nivel = String(params.nivel);
    const { data } = await api.get(`/obras/${obraId}/locais`, { params: query });
    return (data.data ?? data) as ObraLocal[];
  },

  async createLocal(obraId: number, payload: CreateLocalPayload): Promise<ObraLocal> {
    const { data } = await api.post(`/obras/${obraId}/locais`, payload);
    return data.data ?? data;
  },

  async gerarMassa(obraId: number, payload: GerarMassaPayload) {
    const { data } = await api.post(`/obras/${obraId}/locais/gerar-massa`, payload);
    return data.data ?? data;
  },

  async updateLocal(
    obraId: number,
    localId: number,
    payload: Partial<Pick<CreateLocalPayload, 'nome' | 'ordem' | 'dataInicioPrevista' | 'dataFimPrevista'>>,
  ): Promise<ObraLocal> {
    const { data } = await api.put(`/obras/${obraId}/locais/${localId}`, payload);
    return data.data ?? data;
  },

  async removeLocal(obraId: number, localId: number) {
    const { data } = await api.delete(`/obras/${obraId}/locais/${localId}`);
    return data.data ?? data;
  },
};
