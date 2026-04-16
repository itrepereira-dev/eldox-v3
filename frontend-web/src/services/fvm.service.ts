// frontend-web/src/services/fvm.service.ts
import { api } from './api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Criticidade   = 'critico' | 'maior' | 'menor';
export type FotoModo      = 'nenhuma' | 'opcional' | 'obrigatoria';
export type TipoItem      = 'visual' | 'documental' | 'dimensional' | 'ensaio';
export type StatusLote    =
  | 'aguardando_inspecao' | 'em_inspecao' | 'aprovado'
  | 'aprovado_com_ressalva' | 'quarentena' | 'reprovado' | 'cancelado';
export type StatusRegistro = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'nao_aplicavel';
export type SituacaoFornecedor = 'em_avaliacao' | 'homologado' | 'suspenso' | 'desqualificado';

export interface FvmCategoria {
  id: number;
  tenant_id: number;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ordem: number;
  ativo: boolean;
  is_sistema: boolean;
  total_materiais?: number;
}

export interface FvmMaterial {
  id: number;
  tenant_id: number;
  categoria_id: number | null;
  nome: string;
  codigo: string | null;
  norma_referencia: string | null;
  unidade: string;
  descricao: string | null;
  foto_modo: FotoModo;
  exige_certificado: boolean;
  exige_nota_fiscal: boolean;
  exige_laudo_ensaio: boolean;
  prazo_quarentena_dias: number;
  ordem: number;
  ativo: boolean;
  is_sistema: boolean;
  categoria_nome?: string;
  total_itens?: number;
  total_documentos?: number;
}

export interface FvmItem {
  id: number;
  tenant_id: number;
  material_id: number;
  tipo: TipoItem;
  descricao: string;
  criterio_aceite: string | null;
  criticidade: Criticidade;
  foto_modo: FotoModo;
  ordem: number;
  ativo: boolean;
}

export interface FvmFornecedor {
  id: number;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  tipo: string;
  situacao: SituacaoFornecedor;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  avaliacao_score: number | null;
  total_entregas?: number;
  entregas_aprovadas?: number;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface FvmDashboardKpis {
  lotes_recebidos_total: number;
  lotes_aprovados: number;
  lotes_em_quarentena: number;
  lotes_reprovados: number;
  taxa_aprovacao: number;
  ncs_abertas: number;
  ncs_criticas_abertas: number;
  ensaios_reprovados: number;
}

export interface FvmDashboardCategoria {
  categoria_id: number;
  categoria_nome: string;
  total_lotes: number;
  taxa_aprovacao: number;
}

export interface FvmDashboardSemana {
  semana: string;       // "2026-W15"
  aprovados: number;
  quarentena: number;
  reprovados: number;
  aguardando: number;
}

export interface FvmDashboard {
  kpis: FvmDashboardKpis;
  por_categoria: FvmDashboardCategoria[];
  evolucao_semanal: FvmDashboardSemana[];
}

export interface FvmDashboardQuery {
  data_inicio?: string;
  data_fim?: string;
}

// ─── Relatório de Performance — tipos ────────────────────────────────────────

export interface FvmPerformanceFornecedor {
  id: number;
  razao_social: string;
  cnpj: string | null;
  total_lotes: number;
  taxa_aprovacao: number;
  total_ncs: number;
  ncs_criticas: number;
  ensaios_reprovados: number;
  total_ensaios: number;
  score: number;
}

// ─── Relatório de NCs ─────────────────────────────────────────────────────────

export interface FvmNcRelatorio {
  id: number;
  numero: string;
  lote_numero: string;
  material_nome: string;
  fornecedor_nome: string;
  criticidade: Criticidade;
  tipo: string;
  status: string;
  prazo: string | null;
  acao_imediata: string | null;
  sla_ok: boolean;
}

export interface FvmLote {
  id: number;
  obra_id: number;
  material_id: number;
  fornecedor_id: number;
  numero_lote: string;
  numero_nf: string;
  data_entrega: string;
  hora_chegada: string | null;
  quantidade_nf: number | null;
  quantidade_recebida: number | null;
  unidade: string;
  numero_pedido: string | null;
  lote_fabricante: string | null;
  validade: string | null;
  status: StatusLote;
  observacao_geral: string | null;
  quarentena_motivo: string | null;
  quarentena_prazo_dias: number | null;
  material_nome?: string;
  fornecedor_nome?: string;
}

export interface FvmLotePreview extends FvmLote {
  material_nome: string;
  fornecedor_nome: string;
  registros_total: number;
  registros_avaliados: number;
  registros_nc: number;
  itens?: (FvmItem & {
    registro_id: number | null;
    registro_status: StatusRegistro | null;
    registro_observacao: string | null;
  })[];
}

export interface FvmGrade {
  materiais: { id: number; nome: string; unidade: string; categoria_id: number | null; categoria_nome: string | null }[];
  lotes: { id: number; numero_lote: string; data_entrega: string; fornecedor_nome: string; quantidade: number; unidade: string }[];
  celulas: Record<number, Record<number, StatusLote>>;
  resumo: {
    total_lotes: number;
    aprovados: number;
    aprovados_com_ressalva: number;
    quarentena: number;
    reprovados: number;
    aguardando: number;
    em_inspecao: number;
    cancelados: number;
  };
}

// ─── Ensaios ──────────────────────────────────────────────────────────────────

export interface EnsaioTemplate {
  id: number;
  tenant_id: number;
  material_id: number | null;
  nome: string;
  norma_referencia: string | null;
  unidade: string;
  valor_min: number | null;
  valor_max: number | null;
  obrigatorio: boolean;
  ordem: number;
}

export interface FvmEnsaio {
  id: number;
  lote_id: number;
  template_id: number | null;
  nome: string;
  norma_referencia: string | null;
  unidade: string;
  valor_min: number | null;
  valor_max: number | null;
  valor_medido: number | null;
  resultado: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
  data_ensaio: string | null;
  laboratorio_nome: string | null;
  observacoes: string | null;
  registrado_por: number;
  obrigatorio?: boolean;
}

export interface RegistrarEnsaioPayload {
  template_id?: number;
  nome: string;
  norma_referencia?: string;
  unidade: string;
  valor_min?: number;
  valor_max?: number;
  valor_medido?: number;
  data_ensaio?: string;
  laboratorio_nome?: string;
  observacoes?: string;
}

export interface ResultadoLote {
  aprovado: boolean;
  reprovado: boolean;
  pendentes: number;
  falhas: string[];
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateLotePayload {
  material_id: number;
  fornecedor_id: number;
  numero_nf: string;
  data_entrega: string;
  quantidade: number;
  unidade: string;
  numero_pedido?: string;
  lote_fabricante?: string;
  data_fabricacao?: string;
  validade?: string;
  hora_chegada?: string;
  quantidade_nf?: number;
  quantidade_recebida?: number;
  hora_saida_usina?: string;
  slump_especificado?: number;
  slump_medido?: number;
}

export interface PutRegistroPayload {
  item_id: number;
  status: 'conforme' | 'nao_conforme' | 'nao_aplicavel' | 'nao_avaliado';
  observacao?: string;
}

export interface ConcluirInspecaoPayload {
  decisao: 'aprovado' | 'aprovado_com_ressalva' | 'quarentena' | 'reprovado';
  observacao_geral?: string;
  quarentena_motivo?: string;
  quarentena_prazo_dias?: number;
}

export interface CreateFornecedorRapidoPayload {
  razao_social: string;
  cnpj?: string;
  telefone?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const fvmService = {

  // ── Catálogo ────────────────────────────────────────────────────────────────

  getCategorias: (): Promise<FvmCategoria[]> =>
    api.get('/fvm/categorias').then(r => r.data),

  getMateriais: (categoriaId?: number): Promise<FvmMaterial[]> =>
    api.get('/fvm/materiais', { params: { categoriaId } }).then(r => r.data),

  getMaterial: (id: number): Promise<FvmMaterial & { itens: FvmItem[] }> =>
    api.get(`/fvm/materiais/${id}`).then(r => r.data),

  createMaterial: (payload: Partial<FvmMaterial>): Promise<FvmMaterial> =>
    api.post('/fvm/materiais', payload).then(r => r.data),

  updateMaterial: (id: number, payload: Partial<FvmMaterial>): Promise<FvmMaterial> =>
    api.patch(`/fvm/materiais/${id}`, payload).then(r => r.data),

  deleteMaterial: (id: number): Promise<void> =>
    api.delete(`/fvm/materiais/${id}`).then(() => undefined),

  createItem: (materialId: number, payload: Partial<FvmItem>): Promise<FvmItem> =>
    api.post(`/fvm/materiais/${materialId}/itens`, payload).then(r => r.data),

  updateItem: (id: number, payload: Partial<FvmItem>): Promise<FvmItem> =>
    api.patch(`/fvm/itens/${id}`, payload).then(r => r.data),

  deleteItem: (id: number): Promise<void> =>
    api.delete(`/fvm/itens/${id}`).then(() => undefined),

  // ── Fornecedores ────────────────────────────────────────────────────────────

  getFornecedores: (params?: { situacao?: string; search?: string }): Promise<FvmFornecedor[]> =>
    api.get('/fvm/fornecedores', { params }).then(r => r.data),

  createFornecedorRapido: (payload: CreateFornecedorRapidoPayload): Promise<Pick<FvmFornecedor, 'id' | 'razao_social' | 'situacao'>> =>
    api.post('/fvm/fornecedores/rapido', payload).then(r => r.data),

  // ── Grade ───────────────────────────────────────────────────────────────────

  getGrade: (
    obraId: number,
    params?: { categoriaId?: number; fornecedorId?: number; status?: string },
  ): Promise<FvmGrade> =>
    api.get(`/fvm/obras/${obraId}/grade`, { params }).then(r => r.data),

  // ── Lotes ───────────────────────────────────────────────────────────────────

  createLote: (obraId: number, payload: CreateLotePayload): Promise<FvmLote> =>
    api.post(`/fvm/obras/${obraId}/lotes`, payload).then(r => r.data),

  getLotePreview: (loteId: number): Promise<FvmLotePreview> =>
    api.get(`/fvm/lotes/${loteId}/preview`).then(r => r.data),

  getLote: (loteId: number): Promise<FvmLotePreview> =>
    api.get(`/fvm/lotes/${loteId}`).then(r => r.data),

  // ── Inspeção ────────────────────────────────────────────────────────────────

  putRegistro: (loteId: number, payload: PutRegistroPayload): Promise<unknown> =>
    api.put(`/fvm/lotes/${loteId}/registros`, payload).then(r => r.data),

  concluirInspecao: (loteId: number, payload: ConcluirInspecaoPayload): Promise<FvmLote> =>
    api.post(`/fvm/lotes/${loteId}/concluir`, payload).then(r => r.data),

  // ── Ensaios ─────────────────────────────────────────────────────────────────

  getEnsaioTemplates: (materialId: number): Promise<EnsaioTemplate[]> =>
    api.get(`/fvm/materiais/${materialId}/ensaio-templates`).then(r => r.data),

  listarEnsaios: (loteId: number): Promise<FvmEnsaio[]> =>
    api.get(`/fvm/lotes/${loteId}/ensaios`).then(r => r.data),

  registrarEnsaio: (loteId: number, payload: RegistrarEnsaioPayload): Promise<FvmEnsaio> =>
    api.post(`/fvm/lotes/${loteId}/ensaios`, payload).then(r => r.data),

  atualizarEnsaio: (ensaioId: number, payload: Partial<RegistrarEnsaioPayload>): Promise<FvmEnsaio> =>
    api.patch(`/fvm/ensaios/${ensaioId}`, payload).then(r => r.data),

  removerEnsaio: (ensaioId: number): Promise<void> =>
    api.delete(`/fvm/ensaios/${ensaioId}`).then(() => undefined),

  getResultadoEnsaiosLote: (loteId: number): Promise<ResultadoLote> =>
    api.get(`/fvm/lotes/${loteId}/ensaios/resultado`).then(r => r.data),

  // ── Dashboard ───────────────────────────────────────────────────────────────

  getDashboard: (obraId: number, params?: FvmDashboardQuery): Promise<FvmDashboard> =>
    api.get(`/fvm/obras/${obraId}/dashboard`, { params }).then(r => r.data),

  // ── Fornecedor score (R-FVM3) ────────────────────────────────────────────────

  patchFornecedorScore: (fornecedorId: number, score: number): Promise<{ id: number; avaliacao_score: number }> =>
    api.patch(`/fvm/fornecedores/${fornecedorId}/score`, { score }).then(r => r.data),

  // ── NCs da obra (R-FVM2) ──────────────────────────────────────────────────────

  getNcsRelatorio: (
    obraId: number,
    params?: { data_inicio?: string; data_fim?: string; status?: string; criticidade?: string; fornecedor_id?: number },
  ): Promise<FvmNcRelatorio[]> =>
    api.get(`/fvm/obras/${obraId}/ncs`, { params }).then(r => r.data),

  // ── Performance de fornecedores (R-FVM3) — dados calculados client-side ────────

  getPerformanceFornecedores: (
    params?: { obra_id?: number; data_inicio?: string; data_fim?: string },
  ): Promise<FvmPerformanceFornecedor[]> =>
    api.get('/fvm/fornecedores/performance', { params }).then(r => r.data),
};
