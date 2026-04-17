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
  totalInspecoes: number;
  totalFotos: number;
  fotoCapaUrl?: string | null;
  criadoEm: string;
  obraTipo: { id: number; nome: string; slug: string };
}

export interface ObraDetalhe extends Obra {
  endereco?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
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

export type EstrategiaGeracao = 'generica' | 'edificacao' | 'linear' | 'instalacao';

// Personalização do relatório PDF por obra (G8)
export interface RelatorioConfigSecoes {
  clima: boolean;
  mao_obra: boolean;
  equipamentos: boolean;
  atividades: boolean;
  ocorrencias: boolean;
  checklist: boolean;
  fotos: boolean;
  assinaturas: boolean;
}

export interface RelatorioConfig {
  logo_cliente_url: string | null;
  titulo: string | null;
  secoes: RelatorioConfigSecoes;
}

export const obrasService = {
  // Tipos
  async getTipos(): Promise<ObraTipo[]> {
    const { data } = await api.get('/obra-tipos');
    return data.data ?? data;
  },

  // Obras CRUD — retorno polimórfico: lista simples ou objeto paginado
  // ({ items, total, totalPages }). Callers fazem narrowing com Array.isArray.
  // Tipagem proposital solta (padrão do service) para não quebrar callers.
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

  async uploadFotoCapa(obraId: number, file: File): Promise<{ fotoCapaUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/obras/${obraId}/foto-capa`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data ?? data;
  },

  // Personalização do relatório PDF (G8)
  async getRelatorioConfig(obraId: number): Promise<RelatorioConfig> {
    const { data } = await api.get(`/obras/${obraId}/relatorio-config`);
    return (data.data ?? data) as RelatorioConfig;
  },

  async patchRelatorioConfig(
    obraId: number,
    patch: Partial<RelatorioConfig>,
  ): Promise<RelatorioConfig> {
    const { data } = await api.patch(`/obras/${obraId}/relatorio-config`, patch);
    return (data.data ?? data) as RelatorioConfig;
  },

  // Locais
  async getLocais(obraId: number, params?: { parentId?: number | null; nivel?: number; search?: string }) {
    const query: Record<string, string> = {};
    if (params?.parentId !== undefined)
      query.parentId = params.parentId === null ? 'null' : String(params.parentId);
    if (params?.nivel !== undefined)
      query.nivel = String(params.nivel);
    if (params?.search)
      query.search = params.search;
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

  async gerarCascata(obraId: number, estrategia: EstrategiaGeracao, payload: unknown) {
    const { data } = await api.post(`/obras/${obraId}/locais/gerar-cascata`, {
      estrategia,
      payload: { estrategia, ...(payload as object) },
    });
    return data.data ?? data;
  },

  async updateLocal(
    obraId: number,
    localId: number,
    payload: Partial<Pick<CreateLocalPayload, 'nome' | 'ordem' | 'dataInicioPrevista' | 'dataFimPrevista'>> & { status?: string },
  ): Promise<ObraLocal> {
    const { data } = await api.put(`/obras/${obraId}/locais/${localId}`, payload);
    return data.data ?? data;
  },

  async removeLocal(obraId: number, localId: number) {
    const { data } = await api.delete(`/obras/${obraId}/locais/${localId}`);
    return data.data ?? data;
  },

  async duplicarLocal(obraId: number, localId: number): Promise<ObraLocal> {
    const { data } = await api.post(`/obras/${obraId}/locais/${localId}/duplicar`);
    return data.data ?? data;
  },

  async saveNiveisConfig(
    obraId: number,
    niveis: { nivel: number; labelSingular: string; labelPlural: string }[],
  ) {
    const { data } = await api.patch(`/obras/${obraId}/niveis-config`, { niveis });
    return data.data ?? data;
  },

  async getQualityConfig(obraId: number) {
    const { data } = await api.get(`/obras/${obraId}/quality-config`);
    return data.data ?? data;
  },

  async upsertQualityConfig(obraId: number, payload: {
    modoQualidade?: 'SIMPLES' | 'PBQPH';
    slaAprovacaoHoras?: number;
    exigeAssinaturaFVS?: boolean;
    exigeAssinaturaDiario?: boolean;
  }) {
    const { data } = await api.put(`/obras/${obraId}/quality-config`, payload);
    return data.data ?? data;
  },
};
