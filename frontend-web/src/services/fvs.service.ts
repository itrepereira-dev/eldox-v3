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
  tolerancia: string | null;
  metodo_verificacao: string | null;
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
  tolerancia?: string;
  metodoVerificacao?: string;
  criticidade?: Criticidade;
  fotoModo?: FotoModo;
  fotoMinimo?: number;
  fotoMaximo?: number;
  ordem?: number;
  ativo?: boolean;
}

export interface ReorderPayload {
  itens: { id: number; ordem: number }[];
}

export interface GerarCatalogoIAItem {
  descricao: string;
  criterio_aceite: string;
  criticidade: 'critico' | 'maior' | 'menor';
  foto_modo: 'nenhuma' | 'opcional' | 'obrigatoria';
}

export interface GerarCatalogoIAServico {
  nome: string;
  codigo: string;
  categoria: string;
  norma_referencia: string;
  itens: GerarCatalogoIAItem[];
}

export interface GerarCatalogoIAResult {
  servicos: GerarCatalogoIAServico[];
}

export interface ImportResult {
  preview: unknown[];
  errors: string[];
  total: number;
}

// ─── Inspeção Sprint 2 ────────────────────────────────────────────────────────

export type RegimeFicha = 'pbqph' | 'norma_tecnica' | 'livre';
export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida' | 'aguardando_parecer' | 'aprovada';
export type StatusRegistro =
  | 'nao_avaliado'
  | 'nao_aplicavel'
  | 'conforme'
  | 'nao_conforme'
  | 'excecao'
  | 'conforme_apos_reinspecao'
  | 'nc_apos_reinspecao'
  | 'liberado_com_concessao'
  | 'retrabalho';
export type StatusGrade =
  | 'nao_avaliado'
  | 'parcial'
  | 'aprovado'
  | 'nc'
  | 'nc_final'
  | 'liberado'
  | 'pendente';

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
  modelo_id: number | null;
  exige_ro: boolean;
  exige_reinspecao: boolean;
  exige_parecer?: boolean;
  fotos_obrigatorias: 'todas' | 'apenas_nc' | 'nenhuma' | 'itens_selecionados';
  fotos_itens_ids: number[] | null;
  progresso?: number;
  risco_score?: number | null;
  token_cliente?: string | null;
  token_cliente_expires_at?: string | null;
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
  servicos: { id: number; nome: string; codigo?: string }[];
  locais: {
    id: number;
    nome: string;
    pavimento_id: number | null;
    pavimento_nome: string | null;
    ordem: number;
  }[];
  celulas: Record<number, Record<number, StatusGrade>>;
  celulas_meta?: Record<number, Record<number, {
    itens_total: number;
    itens_avaliados: number;
    itens_nc: number;
    ultimo_inspetor?: string;
    ultima_atividade?: string;
  }>>;
  resumo: {
    total_celulas: number;
    aprovadas: number;
    nc: number;
    nc_final: number;
    liberadas: number;
    parciais: number;
    nao_avaliadas: number;
    pendentes: number;
    progresso_pct: number;
  };
}

export interface GradePreview {
  servico_nome: string;
  local_nome: string;
  status_geral: StatusGrade;
  inspetor_nome: string | null;
  ultima_atividade: string | null;
  itens: {
    id: number;
    descricao: string;
    criterio_aceite: string | null;
    criticidade: string;
    status: string;
    observacao: string | null;
  }[];
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
  item_tolerancia: string | null;
  evidencias_count: number;
  equipe_responsavel: string | null;
  created_at: string;
  updated_at: string;
  ciclo?: number;
  desbloqueado?: boolean;
  nc_id?: number | null;
}

export interface FvsEvidencia {
  id: number;
  registro_id: number;
  ged_versao_id: number;
  nome_original: string;
  mime_type?: string;
  created_at: string;
  url?: string;
}

// ─── Sprint 4a: Templates ──────────────────────────────────────────────────

export type StatusModelo = 'rascunho' | 'concluido';
export type EscopoModelo = 'empresa' | 'obra';
export type RegimeModelo = 'livre' | 'pbqph';

export interface FvsModelo {
  id: number;
  tenant_id: number;
  nome: string;
  descricao: string | null;
  versao: number;
  escopo: EscopoModelo;
  obra_id: number | null;
  status: StatusModelo;
  bloqueado: boolean;
  regime: RegimeModelo;
  exige_ro: boolean;
  exige_reinspecao: boolean;
  exige_parecer: boolean;
  fotos_obrigatorias: 'todas' | 'apenas_nc' | 'nenhuma' | 'itens_selecionados';
  fotos_itens_ids: number[] | null;
  is_sistema: boolean;
  concluido_por: number | null;
  concluido_em: string | null;
  criado_por: number | null;
  deleted_at: string | null;
  servicos?: FvsModeloServico[];
  obras_count?: number;
}

export interface FvsModeloServico {
  id: number;
  tenant_id: number;
  modelo_id: number;
  servico_id: number;
  ordem: number;
  itens_excluidos: number[] | null;
  item_fotos: Record<string, number>;
  servico_nome?: string;
}

export interface ObraModeloFvs {
  id: number;
  obra_id: number;
  modelo_id: number;
  fichas_count: number;
  created_at: string;
  modelo_nome?: string;
  obra_nome?: string;
}

export interface CreateModeloPayload {
  nome: string;
  descricao?: string;
  escopo: EscopoModelo;
  obraId?: number;
  regime: RegimeModelo;
  exigeRo?: boolean;
  exigeReinspecao?: boolean;
  exigeParecer?: boolean;
  fotosObrigatorias?: 'todas' | 'apenas_nc' | 'nenhuma' | 'itens_selecionados';
  fotosItensIds?: number[] | null;
}

export interface CreateModeloServicoPayload {
  servicoId: number;
  ordem?: number;
  itensExcluidos?: number[];
  itemFotos?: Record<string, number>;
}

export interface CreateFichaPayload {
  obraId: number;
  nome: string;
  modeloId?: number;
  regime?: 'pbqph' | 'norma_tecnica' | 'livre';
  servicos?: { servicoId: number; localIds: number[]; itensExcluidos?: number[] }[];
}

export interface PaginatedFichas {
  data: FichaFvs[];
  total: number;
  page: number;
}

// ─── Dashboard Gráficos Avançados ─────────────────────────────────────────

export type Granularidade = 'semana' | 'mes';
export type Tendencia = 'subindo' | 'caindo' | 'estavel';

export interface GraficosFiltros {
  data_inicio: string;   // "YYYY-MM-DD"
  data_fim: string;      // "YYYY-MM-DD"
  granularidade: Granularidade;
  servico_ids?: number[];
}

export interface EvolucaoTemporalSerie {
  servico_id: number;
  servico_nome: string;
  cor: string;
  valores: (number | null)[];
}

export interface EvolucaoTemporalData {
  labels: string[];
  series: EvolucaoTemporalSerie[];
}

export interface ConformidadePorServicoItem {
  servico_id: number;
  servico_nome: string;
  total_inspecoes: number;
  taxa_conformidade: number;
  ncs_abertas: number;
  tendencia: Tendencia;
}

export interface HeatmapCelula {
  servico_idx: number;
  periodo_idx: number;
  taxa: number | null;
  total_inspecoes: number;
}

export interface HeatmapData {
  servicos: string[];
  periodos: string[];
  celulas: HeatmapCelula[];
}

export interface FunilData {
  total_fichas: number;
  concluidas: number;
  aprovadas: number;
  com_nc: number;
  com_pa: number;
}

export interface DashboardGraficosData {
  evolucao_temporal: EvolucaoTemporalData;
  conformidade_por_servico: ConformidadePorServicoItem[];
  heatmap: HeatmapData;
  funil: FunilData;
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
  async updateCategoria(id: number, payload: Partial<CreateCategoriaPayload & { ativo: boolean }>): Promise<FvsCategoria> {
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
  async updateServico(id: number, payload: Partial<CreateServicoPayload & { ativo: boolean }>): Promise<FvsServico> {
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
  async addServico(
    fichaId: number,
    payload: { servicoId: number; localIds: number[]; itensExcluidos?: number[] },
  ): Promise<void> {
    await api.post(`/fvs/fichas/${fichaId}/servicos`, payload);
  },
  async removeServico(fichaId: number, servicoId: number): Promise<void> {
    await api.delete(`/fvs/fichas/${fichaId}/servicos/${servicoId}`);
  },

  // ─── Grade ─────────────────────────────────────────────────────────────────────
  async getGrade(fichaId: number, params?: { pavimentoId?: number; servicoId?: number }): Promise<FvsGrade> {
    const { data } = await api.get(`/fvs/fichas/${fichaId}/grade`, { params });
    return data;
  },

  async getGradePreview(fichaId: number, localId: number, servicoId: number): Promise<GradePreview> {
    const { data } = await api.get<{ data: GradePreview }>(
      `/fvs/fichas/${fichaId}/locais/${localId}/servico/${servicoId}/preview`,
    );
    return data.data;
  },

  async bulkInspecaoLocais(
    fichaId: number,
    payload: { servicoId: number; localIds: number[]; status: 'conforme' | 'excecao'; observacao?: string },
  ): Promise<{ processados: number; ignorados: number; erros: number }> {
    const { data } = await api.post<{ data: { processados: number; ignorados: number; erros: number } }>(
      `/fvs/fichas/${fichaId}/registros/bulk`,
      payload,
    );
    return data.data;
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

  // ─── Modelos (Templates) ──────────────────────────────────────────────────
  async getModelos(params?: { escopo?: string; status?: string }): Promise<FvsModelo[]> {
    const { data } = await api.get('/fvs/modelos', { params });
    return data;
  },

  async getModelo(id: number): Promise<FvsModelo> {
    const { data } = await api.get(`/fvs/modelos/${id}`);
    return data;
  },

  async createModelo(payload: CreateModeloPayload): Promise<FvsModelo> {
    const { data } = await api.post('/fvs/modelos', payload);
    return data;
  },

  async updateModelo(id: number, payload: Partial<CreateModeloPayload>): Promise<FvsModelo> {
    const { data } = await api.patch(`/fvs/modelos/${id}`, payload);
    return data;
  },

  async deleteModelo(id: number): Promise<void> {
    await api.delete(`/fvs/modelos/${id}`);
  },

  async concluirModelo(id: number): Promise<FvsModelo> {
    const { data } = await api.post(`/fvs/modelos/${id}/concluir`);
    return data;
  },

  async reabrirModelo(id: number): Promise<FvsModelo> {
    const { data } = await api.post(`/fvs/modelos/${id}/reabrir`);
    return data;
  },

  async duplicarModelo(id: number): Promise<FvsModelo> {
    const { data } = await api.post(`/fvs/modelos/${id}/duplicar`);
    return data;
  },

  async addServicoModelo(modeloId: number, payload: CreateModeloServicoPayload): Promise<FvsModeloServico> {
    const { data } = await api.post(`/fvs/modelos/${modeloId}/servicos`, payload);
    return data;
  },

  async updateServicoModelo(modeloId: number, servicoId: number, payload: { ordem?: number; itensExcluidos?: number[] }): Promise<FvsModeloServico> {
    const { data } = await api.patch(`/fvs/modelos/${modeloId}/servicos/${servicoId}`, payload);
    return data;
  },

  async deleteServicoModelo(modeloId: number, servicoId: number): Promise<void> {
    await api.delete(`/fvs/modelos/${modeloId}/servicos/${servicoId}`);
  },

  async vincularModeloObras(modeloId: number, obraIds: number[]): Promise<void> {
    await api.post(`/fvs/modelos/${modeloId}/obras`, { obraIds });
  },

  async getObrasModelo(modeloId: number): Promise<ObraModeloFvs[]> {
    const { data } = await api.get(`/fvs/modelos/${modeloId}/obras`);
    return data;
  },

  async desvincularModeloObraByModelo(modeloId: number, obraId: number): Promise<void> {
    await api.delete(`/obras/${obraId}/modelos/${modeloId}`);
  },

  async getModelosByObra(obraId: number): Promise<ObraModeloFvs[]> {
    const { data } = await api.get(`/obras/${obraId}/modelos`);
    return data;
  },

  async desvincularModeloObra(obraId: number, modeloId: number): Promise<void> {
    await api.delete(`/obras/${obraId}/modelos/${modeloId}`);
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

  // ─── IA ───────────────────────────────────────────────────────────────────────

  async gerarCatalogoIA(payload: {
    tipo_obra: string;
    servicos?: string;
    normas?: string;
    nivel_detalhe: 'basico' | 'intermediario' | 'avancado';
  }): Promise<GerarCatalogoIAResult> {
    const { data } = await api.post('/fvs/ia/gerar-catalogo', payload);
    return data;
  },

  // ─── Token Portal Cliente ─────────────────────────────────────────────────
  async gerarTokenCliente(fichaId: number, diasValidade = 30): Promise<{ token: string; expires_at: string; url: string }> {
    const { data } = await api.post(`/fvs/fichas/${fichaId}/gerar-token-cliente`, { diasValidade });
    return data;
  },
  async revogarTokenCliente(fichaId: number): Promise<void> {
    await api.delete(`/fvs/fichas/${fichaId}/token-cliente`);
  },

  // ─── Análise IA de Foto ────────────────────────────────────────────────────
  async analisarFotoIA(evidenciaId: number, imageBase64: string, mimeType?: string): Promise<{
    status_sugerido: string; confianca: number; observacoes: string; pontos_atencao: string[]; fonte: string;
  }> {
    const { data } = await api.post(`/fvs/evidencias/${evidenciaId}/analisar-foto`, {
      image_base64: imageBase64, mime_type: mimeType ?? 'image/jpeg',
    });
    return data;
  },

  // ─── Risco ────────────────────────────────────────────────────────────────
  async calcularRisco(fichaId: number): Promise<{ fichaId: number; risco_score: number; calculado_em: string }> {
    const { data } = await api.post(`/fvs/fichas/${fichaId}/calcular-risco`);
    return data;
  },

  // ─── Dashboard Gráficos Avançados ─────────────────────────────────────────
  async getDashboardGraficos(obraId: number, filtros: GraficosFiltros): Promise<DashboardGraficosData> {
    const params: Record<string, string | string[]> = {
      data_inicio: filtros.data_inicio,
      data_fim: filtros.data_fim,
      granularidade: filtros.granularidade,
    };
    if (filtros.servico_ids && filtros.servico_ids.length > 0) {
      params['servico_ids'] = filtros.servico_ids.map(String);
    }
    const { data } = await api.get(`/fvs/dashboard/obras/${obraId}/dashboard-graficos`, { params });
    return data;
  },
};
