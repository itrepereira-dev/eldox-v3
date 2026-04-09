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

// ─── Inspeção Sprint 2 ────────────────────────────────────────────────────────

export type RegimeFicha = 'pbqph' | 'norma_tecnica' | 'livre';
export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida' | 'aguardando_parecer' | 'aprovada';
export type StatusRegistro = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao';
export type StatusGrade = 'nao_avaliado' | 'aprovado' | 'nc' | 'pendente';

export type StatusRo = 'aberto' | 'concluido';
export type StatusServicoNc = 'pendente' | 'desbloqueado' | 'verificado';
export type DecisaoParecer = 'aprovado' | 'rejeitado';

export interface RoServicoItemNc {
  id: number; ro_servico_nc_id: number; registro_id: number;
  item_descricao: string; item_criticidade: Criticidade;
}
export interface RoServicoEvidencia {
  id: number; ro_servico_nc_id: number; versao_ged_id: number;
  descricao: string | null; created_at: string;
  url?: string; nome_original?: string;
}
export interface RoServicoNc {
  id: number; ro_id: number; servico_id: number; servico_nome: string;
  acao_corretiva: string | null; status: StatusServicoNc;
  ciclo_reinspecao: number | null; desbloqueado_em: string | null;
  verificado_em: string | null; created_at: string;
  itens?: RoServicoItemNc[]; evidencias?: RoServicoEvidencia[];
}
export interface RoOcorrencia {
  id: number; ficha_id: number; ciclo_numero: number; numero: string;
  tipo: 'real' | 'potencial'; responsavel_id: number; data_ocorrencia: string;
  o_que_aconteceu: string | null; acao_imediata: string | null;
  causa_6m: string | null; justificativa_causa: string | null;
  status: StatusRo; created_at: string; updated_at: string;
  servicos?: RoServicoNc[];
}
export interface SubmitParecerPayload {
  decisao: DecisaoParecer; observacao?: string;
  itens_referenciados?: { registro_id: number; item_descricao: string; servico_nome: string }[];
}

export interface FichaFvs {
  id: number;
  tenant_id: number;
  obra_id: number;
  nome: string;
  regime: RegimeFicha;
  status: StatusFicha;
  criado_por: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  progresso?: number;
}

export interface FichaDetalhada extends FichaFvs {
  servicos: FichaServico[];
  progresso: number;
}

export interface FichaServico {
  id: number;
  ficha_id: number;
  servico_id: number;
  servico_nome: string;
  ordem: number;
  itens_excluidos: number[] | null;
  locais: FichaServicoLocal[];
}

export interface FichaServicoLocal {
  id: number;
  ficha_servico_id: number;
  obra_local_id: number;
  local_nome: string;
  equipe_responsavel: string | null;
}

export interface FvsGrade {
  servicos: { id: number; nome: string }[];
  locais: { id: number; nome: string; pavimento_id: number | null }[];
  celulas: Record<number, Record<number, StatusGrade>>;
}

export interface FvsRegistro {
  id: number;
  ficha_id: number;
  servico_id: number;
  item_id: number;
  obra_local_id: number;
  status: StatusRegistro;
  observacao: string | null;
  inspecionado_por: number | null;
  inspecionado_em: string | null;
  item_descricao: string;
  item_criticidade: Criticidade;
  item_criterio_aceite: string | null;
  evidencias_count: number;
  equipe_responsavel: string | null;
  created_at: string;
  updated_at: string;
  ciclo?: number;
  desbloqueado?: boolean;
}

export interface FvsEvidencia {
  id: number;
  registro_id: number;
  ged_versao_id: number;
  nome_original: string;
  created_at: string;
  url?: string;
}

export interface CreateFichaPayload {
  obraId: number;
  nome: string;
  regime: RegimeFicha;
  servicos: { servicoId: number; localIds: number[]; itensExcluidos?: number[] }[];
}

export interface PaginatedFichas {
  data: FichaFvs[];
  total: number;
  page: number;
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

  // ─── Fichas ────────────────────────────────────────────────────────────────────
  async createFicha(payload: CreateFichaPayload): Promise<FichaFvs> {
    const { data } = await api.post('/fvs/fichas', payload);
    return data;
  },
  async getFichas(params?: { obraId?: number; page?: number; limit?: number }): Promise<PaginatedFichas> {
    const { data } = await api.get('/fvs/fichas', { params });
    return data;
  },
  async getFicha(id: number): Promise<FichaDetalhada> {
    const { data } = await api.get(`/fvs/fichas/${id}`);
    return data;
  },
  async patchFicha(id: number, payload: { nome?: string; status?: StatusFicha }): Promise<FichaFvs> {
    const { data } = await api.patch(`/fvs/fichas/${id}`, payload);
    return data;
  },
  async deleteFicha(id: number): Promise<void> {
    await api.delete(`/fvs/fichas/${id}`);
  },

  // ─── Grade ─────────────────────────────────────────────────────────────────────
  async getGrade(fichaId: number, params?: { pavimentoId?: number; servicoId?: number }): Promise<FvsGrade> {
    const { data } = await api.get(`/fvs/fichas/${fichaId}/grade`, { params });
    return data;
  },

  // ─── Registros ─────────────────────────────────────────────────────────────────
  async getRegistros(fichaId: number, servicoId: number, localId: number): Promise<FvsRegistro[]> {
    const { data } = await api.get(`/fvs/fichas/${fichaId}/registros`, {
      params: { servicoId, localId },
    });
    return data;
  },
  async putRegistro(
    fichaId: number,
    payload: { servicoId: number; itemId: number; localId: number; status: StatusRegistro; observacao?: string; ciclo?: number },
  ): Promise<FvsRegistro> {
    const { data } = await api.put(`/fvs/fichas/${fichaId}/registros`, payload);
    return data;
  },

  // ─── Local (equipe) ────────────────────────────────────────────────────────────
  async patchLocal(fichaId: number, localId: number, payload: { equipeResponsavel?: string | null }): Promise<void> {
    await api.patch(`/fvs/fichas/${fichaId}/locais/${localId}`, payload);
  },

  // ─── Evidências ────────────────────────────────────────────────────────────────
  async getEvidencias(registroId: number): Promise<FvsEvidencia[]> {
    const { data } = await api.get(`/fvs/registros/${registroId}/evidencias`);
    return data;
  },
  async createEvidencia(registroId: number, file: File): Promise<FvsEvidencia> {
    const form = new FormData();
    form.append('arquivo', file);
    const { data } = await api.post(`/fvs/registros/${registroId}/evidencias`, form);
    return data;
  },
  async deleteEvidencia(id: number): Promise<void> {
    await api.delete(`/fvs/evidencias/${id}`);
  },

  // ─── RO (Registro de Ocorrência) ───────────────────────────────────────────────
  async getRo(fichaId: number): Promise<RoOcorrencia> {
    const { data } = await api.get(`/fvs/fichas/${fichaId}/ro`);
    return data;
  },
  async patchRo(fichaId: number, payload: {
    tipo?: 'real' | 'potencial';
    o_que_aconteceu?: string | null;
    acao_imediata?: string | null;
    causa_6m?: string | null;
    justificativa_causa?: string | null;
    status?: StatusRo;
  }): Promise<RoOcorrencia> {
    const { data } = await api.patch(`/fvs/fichas/${fichaId}/ro`, payload);
    return data;
  },
  async patchServicoNc(fichaId: number, servicoNcId: number, payload: {
    acao_corretiva?: string | null;
    desbloquear?: boolean;
    verificar?: boolean;
  }): Promise<RoServicoNc> {
    const { data } = await api.patch(`/fvs/fichas/${fichaId}/ro/servicos/${servicoNcId}`, payload);
    return data;
  },
  async createRoEvidencia(fichaId: number, servicoNcId: number, file: File): Promise<RoServicoEvidencia> {
    const form = new FormData();
    form.append('arquivo', file);
    const { data } = await api.post(`/fvs/fichas/${fichaId}/ro/servicos/${servicoNcId}/evidencias`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  async deleteRoEvidencia(fichaId: number, servicoNcId: number, evidenciaId: number): Promise<void> {
    await api.delete(`/fvs/fichas/${fichaId}/ro/servicos/${servicoNcId}/evidencias/${evidenciaId}`);
  },

  // ─── Parecer ──────────────────────────────────────────────────────────────────
  async solicitarParecer(fichaId: number): Promise<FichaFvs> {
    const { data } = await api.post(`/fvs/fichas/${fichaId}/solicitar-parecer`);
    return data;
  },
  async submitParecer(fichaId: number, payload: SubmitParecerPayload): Promise<FichaFvs> {
    const { data } = await api.post(`/fvs/fichas/${fichaId}/parecer`, payload);
    return data;
  },
};
