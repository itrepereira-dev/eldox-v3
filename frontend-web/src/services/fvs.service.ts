// frontend-web/src/services/fvs.service.ts
import { api } from './api';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type Criticidade = 'critico' | 'maior' | 'menor';
export type FotoModo = 'nenhuma' | 'opcional' | 'obrigatoria';

export interface FvsCategoria {
  id: number;
  tenant_id: number;
  nome: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  is_sistema: boolean;
}

export interface FvsServico {
  id: number;
  tenant_id: number;
  categoria_id: number | null;
  codigo: string | null;
  nome: string;
  norma_referencia: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  is_sistema: boolean;
  itens?: FvsItem[];
}

export interface FvsItem {
  id: number;
  tenant_id: number;
  servico_id: number;
  descricao: string;
  criterio_aceite: string | null;
  criticidade: Criticidade;
  foto_modo: FotoModo;
  foto_minimo: number;
  foto_maximo: number;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

export interface CreateCategoriaPayload {
  nome: string;
  ordem?: number;
}

export interface CreateServicoPayload {
  categoriaId?: number;
  codigo?: string;
  nome: string;
  normaReferencia?: string;
  ordem?: number;
  itens?: CreateItemPayload[];
}

export interface CreateItemPayload {
  descricao: string;
  criterioAceite?: string;
  criticidade?: Criticidade;
  fotoModo?: FotoModo;
  fotoMinimo?: number;
  fotoMaximo?: number;
  ordem?: number;
}

export interface ReorderPayload {
  itens: { id: number; ordem: number }[];
}

export interface ImportResult {
  preview: unknown[];
  errors: string[];
  total: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const fvsService = {
  // Categorias
  async getCategorias(): Promise<FvsCategoria[]> {
    const { data } = await api.get('/fvs/categorias');
    return data;
  },
  async createCategoria(payload: CreateCategoriaPayload): Promise<FvsCategoria> {
    const { data } = await api.post('/fvs/categorias', payload);
    return data;
  },
  async updateCategoria(id: number, payload: Partial<CreateCategoriaPayload>): Promise<FvsCategoria> {
    const { data } = await api.patch(`/fvs/categorias/${id}`, payload);
    return data;
  },
  async deleteCategoria(id: number): Promise<void> {
    await api.delete(`/fvs/categorias/${id}`);
  },
  async reordenarCategorias(payload: ReorderPayload): Promise<void> {
    await api.patch('/fvs/categorias/ordem', payload);
  },

  // Serviços
  async getServicos(categoriaId?: number): Promise<FvsServico[]> {
    const { data } = await api.get('/fvs/servicos', {
      params: categoriaId ? { categoriaId } : undefined,
    });
    return data;
  },
  async getServico(id: number): Promise<FvsServico> {
    const { data } = await api.get(`/fvs/servicos/${id}`);
    return data;
  },
  async createServico(payload: CreateServicoPayload): Promise<FvsServico> {
    const { data } = await api.post('/fvs/servicos', payload);
    return data;
  },
  async updateServico(id: number, payload: Partial<CreateServicoPayload>): Promise<FvsServico> {
    const { data } = await api.patch(`/fvs/servicos/${id}`, payload);
    return data;
  },
  async deleteServico(id: number): Promise<void> {
    await api.delete(`/fvs/servicos/${id}`);
  },
  async clonarServico(id: number): Promise<FvsServico> {
    const { data } = await api.post(`/fvs/servicos/${id}/clonar`);
    return data;
  },
  async importarCsv(file: File, dryRun = false): Promise<ImportResult> {
    const form = new FormData();
    form.append('arquivo', file);
    const { data } = await api.post('/fvs/servicos/importar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { dry_run: dryRun },
    });
    return data;
  },
  async reordenarItens(servicoId: number, payload: ReorderPayload): Promise<void> {
    await api.patch(`/fvs/servicos/${servicoId}/itens/ordem`, payload);
  },

  // Itens
  async createItem(servicoId: number, payload: CreateItemPayload): Promise<FvsItem> {
    const { data } = await api.post(`/fvs/servicos/${servicoId}/itens`, payload);
    return data;
  },
  async updateItem(id: number, payload: Partial<CreateItemPayload>): Promise<FvsItem> {
    const { data } = await api.patch(`/fvs/itens/${id}`, payload);
    return data;
  },
  async deleteItem(id: number): Promise<void> {
    await api.delete(`/fvs/itens/${id}`);
  },
};
