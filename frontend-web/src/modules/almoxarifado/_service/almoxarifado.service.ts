// frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts
import { api } from '@/services/api';

const BASE = 'almoxarifado';

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AlmMovimentoTipo = 'entrada' | 'saida' | 'transferencia' | 'perda' | 'ajuste';
export type AlmNivelAlerta   = 'critico' | 'atencao' | 'normal';
export type AlmTipoAlerta    = 'estoque_minimo' | 'reposicao_prevista' | 'anomalia';

export type AlmLocalTipo = 'CENTRAL' | 'CD' | 'DEPOSITO' | 'OBRA';

export type AlmTransferenciaStatus =
  | 'rascunho' | 'aguardando_aprovacao' | 'aprovada' | 'executada' | 'cancelada';

export interface AlmLocal {
  id: number;
  tenant_id: number;
  tipo: AlmLocalTipo;
  nome: string;
  descricao: string | null;
  obra_id: number | null;
  endereco: string | null;
  responsavel_nome: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  obra_nome?: string | null;
}

export interface AlmTransferenciaItem {
  id: number;
  transferencia_id: number;
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  qtd_executada: number;
  catalogo_nome?: string | null;
}

export interface AlmTransferencia {
  id: number;
  tenant_id: number;
  local_origem_id: number;
  local_destino_id: number;
  local_origem_nome: string;
  local_destino_nome: string;
  status: AlmTransferenciaStatus;
  valor_total: number | null;
  solicitante_id: number;
  aprovador_id: number | null;
  aprovado_at: string | null;
  observacao: string | null;
  executada_parcial: boolean;
  created_at: string;
  updated_at: string;
  itens?: AlmTransferenciaItem[];
}

export interface AlmConfigTransferencia {
  id: number | null;
  tenant_id: number;
  valor_limite_direto: number;
  roles_aprovadores: string[];
  created_at: string | null;
  updated_at: string | null;
}

export type AlmSolicitacaoStatus =
  | 'rascunho' | 'aguardando_aprovacao' | 'em_aprovacao'
  | 'aprovada' | 'reprovada' | 'cancelada';

export type AlmOcStatus =
  | 'rascunho' | 'confirmada' | 'emitida'
  | 'parcialmente_recebida' | 'recebida' | 'cancelada';

export type AlmNfeStatus =
  | 'pendente_match' | 'match_parcial' | 'match_ok' | 'aceita' | 'rejeitada' | 'sem_oc';

export interface AlmEstoqueSaldo {
  id: number;
  catalogo_id: number;
  local_id: number;
  quantidade: number;
  estoque_min: number;
  unidade: string;
  catalogo_nome: string;
  catalogo_codigo: string | null;
  local_nome: string | null;
  local_tipo?: AlmLocalTipo;
  nivel: AlmNivelAlerta;
  updated_at: string;
}

export interface AlmMovimento {
  id: number;
  catalogo_id: number;
  local_id: number;
  tipo: AlmMovimentoTipo;
  quantidade: number;
  unidade: string;
  saldo_anterior: number;
  saldo_posterior: number;
  referencia_tipo: string | null;
  referencia_id: number | null;
  observacao: string | null;
  criado_por: number | null;
  created_at: string;
  catalogo_nome: string;
  local_nome: string | null;
  local_tipo?: AlmLocalTipo;
  usuario_nome: string | null;
}

export interface AlmAlertaEstoque {
  id: number;
  catalogo_id: number;
  local_id: number;
  tipo: AlmTipoAlerta;
  nivel: AlmNivelAlerta;
  mensagem: string;
  lido: boolean;
  criado_at: string;
  catalogo_nome: string;
}

export interface AlmOrcamentoVersao {
  id: number;
  obra_id: number;
  versao: number;
  nome: string | null;
  ativo: boolean;
  created_at: string;
  total_itens: number;
  importado_por_nome?: string | null;
}

export interface AlmOrcamentoItem {
  id: number;
  versao_id: number;
  catalogo_id: number | null;
  descricao_orig: string;
  unidade: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  mes_previsto: number | null;
  etapa: string | null;
  catalogo_nome: string | null;
}

export type AlmMatchStatus = 'auto' | 'pendente' | 'sem_match' | 'confirmado_manual';

export interface AiSugestaoMatch {
  catalogo_id: number;
  nome: string;
  score: number;
  motivo: string;
}

export interface AlmNfeItem {
  id: number;
  nfe_id: number;
  xprod: string;
  ncm: string | null;
  cfop: string | null;
  unidade_nfe: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  catalogo_id: number | null;
  match_status: AlmMatchStatus;
  ai_score: number | null;
  ai_sugestoes: AiSugestaoMatch[] | null;
  confirmado_por: number | null;
  confirmado_at: string | null;
  catalogo_nome: string | null;
  /** UM padrão do catálogo vinculado. Quando diferente de `unidade_nfe`,
   *  a UI exibe preview de conversão antes do aceite. */
  catalogo_unidade_padrao: string | null;
}

export interface AlmNotaFiscal {
  id: number;
  local_id: number | null;
  oc_id: number | null;
  chave_nfe: string;
  numero: string | null;
  serie: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  status: AlmNfeStatus;
  aceito_por: number | null;
  aceito_at: string | null;
  created_at: string;
  oc_numero: string | null;
  aceito_por_nome: string | null;
  local_nome?: string | null;
  total_itens?: number;
  itens?: AlmNfeItem[];
}

export interface AlmOrdemCompra {
  id: number;
  local_destino_id: number;
  solicitacao_id: number | null;
  fornecedor_id: number;
  numero: string;
  status: AlmOcStatus;
  valor_total: number | null;
  prazo_entrega: string | null;
  condicao_pgto: string | null;
  local_entrega: string | null;
  observacoes: string | null;
  pdf_url: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  fornecedor_nome: string;
  criado_por_nome: string | null;
  local_destino_nome?: string | null;
  total_itens?: number;
  itens?: AlmOcItem[];
}

export interface AlmOcItem {
  id: number;
  oc_id: number;
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  preco_unitario: number | null;
  qtd_recebida: number;
  catalogo_nome: string;
  catalogo_codigo: string | null;
}

export interface AlmSolicitacao {
  id: number;
  local_destino_id: number;
  numero: number;
  descricao: string;
  status: AlmSolicitacaoStatus;
  urgente: boolean;
  data_necessidade: string | null;
  servico_ref: string | null;
  etapa_atual: number;
  solicitante_id: number | null;
  created_at: string;
  updated_at: string;
  solicitante_nome?: string | null;
  local_destino_nome?: string | null;
  total_itens?: number;
  itens?: AlmSolicitacaoItem[];
  aprovacoes?: AlmAprovacao[];
}

export interface AlmSolicitacaoItem {
  id: number;
  solicitacao_id: number;
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  observacao: string | null;
  catalogo_nome: string;
  catalogo_codigo: string | null;
}

export interface AlmAprovacao {
  id: number;
  solicitacao_id: number;
  etapa: number;
  acao: 'aprovado' | 'reprovado' | 'cancelado';
  aprovador_id: number | null;
  observacao: string | null;
  created_at: string;
  aprovador_nome?: string | null;
}

export interface AlmDashboardKpis {
  itens_estoque_minimo: number;
  solicitacoes_pendentes: number;
  nfe_aguardando_match: number;
  valor_oc_aberto: number;
  conformidade_recebimento_pct: number;
}

// ── Sprint 5: Planejamento + IA Preditiva ──────────────────────────────────────

export interface AlmPlanejamentoItem {
  id: number;
  obra_id: number;
  catalogo_id: number;
  mes: number;
  ano: number;
  quantidade: number;
  unidade: string;
  observacao: string | null;
  criado_por: number | null;
  created_at: string;
  updated_at: string;
  catalogo_nome: string;
  catalogo_codigo: string | null;
  consumo_realizado: number;
}

export interface AlmPlanejamentoPeriodo {
  mes: number;
  ano: number;
  total_itens: number;
}

export interface AlmReorderPrediction {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  quantidade_atual: number;
  consumo_medio_diario: number;
  dias_restantes: number;
  nivel: 'critico' | 'atencao';
  recomendacao_qty: number;
  analise_ia: string;
  local_id: number;
}

export interface AlmAnomaliaDetectada {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  consumo_recente_7d: number;
  consumo_medio_30d: number;
  fator_desvio: number;
  nivel: 'critico' | 'atencao';
  explicacao_ia: string;
  local_id: number;
}

export interface AlmInsightsResult {
  reorder: AlmReorderPrediction[];
  anomalias: AlmAnomaliaDetectada[];
  analisado_em: string;
  modelo: string;
}

export type AlmSugestaoStatus = 'pendente' | 'aplicado' | 'ignorado';
export type AlmSugestaoTipo   = 'reorder' | 'anomalia';

export interface AlmSugestaoIa {
  id:            number;
  tipo:          AlmSugestaoTipo;
  catalogo_id:   number;
  catalogo_nome: string;
  local_id:      number;
  unidade:       string;
  dados_json:    AlmReorderPrediction | AlmAnomaliaDetectada;
  status:        AlmSugestaoStatus;
  solicitacao_id?: number;
  criado_em:     string;
  atualizado_em: string;
}

export interface ImportacaoResultado {
  processadas: number;
  erros: Array<{ linha: number; motivo: string }>;
  avisos: Array<{ linha: number; motivo: string }>;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateOcItemPayload {
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  preco_unitario?: number;
}

export interface CreateOcPayload {
  local_destino_id: number;
  fornecedor_id: number;
  solicitacao_id?: number;
  prazo_entrega?: string;
  condicao_pgto?: string;
  local_entrega?: string;
  observacoes?: string;
  itens: CreateOcItemPayload[];
}

export interface ReceberOcItemPayload {
  item_id: number;
  qtd_recebida: number;
}

export interface CreateSolicitacaoItemPayload {
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  observacao?: string;
}

export interface CreateSolicitacaoPayload {
  local_destino_id: number;
  descricao: string;
  urgente?: boolean;
  data_necessidade?: string;
  servico_ref?: string;
  itens: CreateSolicitacaoItemPayload[];
}

export interface AprovarSolicitacaoPayload {
  acao: 'aprovado' | 'reprovado';
  observacao?: string;
}

export interface CreateMovimentoPayload {
  local_id: number;
  catalogo_id: number;
  tipo: AlmMovimentoTipo;
  quantidade: number;
  unidade: string;
  referencia_tipo?: string;
  referencia_id?: number;
  observacao?: string;
}

export interface CreateLocalPayload {
  tipo: AlmLocalTipo;
  nome: string;
  descricao?: string | null;
  obra_id?: number | null;
  endereco?: string | null;
  responsavel_nome?: string | null;
}

export interface CreateTransferenciaItemPayload {
  catalogo_id: number;
  quantidade: number;
  unidade: string;
}

export interface CreateTransferenciaPayload {
  local_origem_id: number;
  local_destino_id: number;
  observacao?: string | null;
  itens: CreateTransferenciaItemPayload[];
}

export interface ExecutarTransferenciaItemPayload {
  item_id: number;
  qtd_executada: number;
}

export interface ExecutarTransferenciaPayload {
  itens?: ExecutarTransferenciaItemPayload[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const almoxarifadoService = {

  // Dashboard
  getDashboardKpis: (localId?: number): Promise<AlmDashboardKpis> =>
    api.get(`${BASE}/dashboard${buildQuery({ local_id: localId })}`).then((r: any) => r.data?.data ?? r.data),

  // Estoque (saldo)
  getSaldo: (
    params?: { localId?: number; tipoLocal?: string; catalogoId?: number; nivel?: string },
  ): Promise<AlmEstoqueSaldo[]> => {
    const q = new URLSearchParams();
    if (params?.localId)    q.set('local_id',    String(params.localId));
    if (params?.tipoLocal)  q.set('tipo_local',  params.tipoLocal);
    if (params?.catalogoId) q.set('catalogoId',  String(params.catalogoId));
    if (params?.nivel)      q.set('nivel',       params.nivel);
    return api.get(`${BASE}/estoque/saldo${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  // Movimentos
  getMovimentos: (
    params?: { localId?: number; catalogoId?: number; tipo?: string; limit?: number; offset?: number },
  ): Promise<AlmMovimento[]> => {
    const q = new URLSearchParams();
    if (params?.localId)    q.set('local_id',    String(params.localId));
    if (params?.catalogoId) q.set('catalogoId',  String(params.catalogoId));
    if (params?.tipo)       q.set('tipo',        params.tipo);
    if (params?.limit)      q.set('limit',       String(params.limit));
    if (params?.offset)     q.set('offset',      String(params.offset));
    return api.get(`${BASE}/estoque/movimentos${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  registrarMovimento: (payload: CreateMovimentoPayload): Promise<AlmMovimento> =>
    api.post(`${BASE}/estoque/movimentos`, payload).then((r: any) => r.data?.data ?? r.data),

  // Alertas
  getAlertas: (params?: { localId?: number; todos?: boolean }): Promise<AlmAlertaEstoque[]> =>
    api.get(`${BASE}/estoque/alertas${buildQuery({ local_id: params?.localId, todos: params?.todos ? 'true' : undefined })}`).then((r: any) => r.data?.data ?? r.data),

  marcarAlertaLido: (alertaId: number): Promise<void> =>
    api.patch(`${BASE}/estoque/alertas/${alertaId}/ler`, {}).then((r: any) => r.data?.data ?? r.data),

  marcarTodosLidos: (localId?: number): Promise<void> =>
    api.patch(`${BASE}/estoque/alertas/ler-todos`, localId ? { local_id: localId } : {}).then((r: any) => r.data?.data ?? r.data),

  // Orçamento
  getOrcamentoVersoes: (obraId: number): Promise<AlmOrcamentoVersao[]> =>
    api.get(`${BASE}/obras/${obraId}/orcamentos`).then((r: any) => r.data?.data ?? r.data),

  importarOrcamento: (obraId: number, file: File, nome?: string): Promise<AlmOrcamentoVersao> => {
    const form = new FormData();
    form.append('file', file);
    if (nome) form.append('nome', nome);
    return api.postForm(`${BASE}/obras/${obraId}/orcamentos/import`, form).then((r: any) => r.data?.data ?? r.data);
  },

  ativarOrcamento: (versaoId: number): Promise<void> =>
    api.patch(`${BASE}/orcamentos/${versaoId}/ativar`, {}).then((r: any) => r.data?.data ?? r.data),

  getOrcamentoItens: (
    versaoId: number,
    params?: { limit?: number; offset?: number; semMatch?: boolean },
  ): Promise<AlmOrcamentoItem[]> => {
    const q = new URLSearchParams();
    if (params?.limit)    q.set('limit',    String(params.limit));
    if (params?.offset)   q.set('offset',   String(params.offset));
    if (params?.semMatch) q.set('semMatch', 'true');
    return api.get(`${BASE}/orcamentos/${versaoId}/itens${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  // NF-e
  getNfes: (
    params?: { localId?: number; status?: string; limit?: number; offset?: number },
  ): Promise<AlmNotaFiscal[]> => {
    const q = new URLSearchParams();
    if (params?.localId) q.set('local_id', String(params.localId));
    if (params?.status)  q.set('status',   params.status);
    if (params?.limit)   q.set('limit',    String(params.limit));
    if (params?.offset)  q.set('offset',   String(params.offset));
    return api.get(`${BASE}/notas-fiscais${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  getNfe: (id: number): Promise<AlmNotaFiscal> =>
    api.get(`${BASE}/nfes/${id}`).then((r: any) => r.data?.data ?? r.data),

  aceitarNfe: (id: number, payload: { local_id: number; oc_id?: number; observacao?: string }): Promise<void> =>
    api.post(`${BASE}/nfes/${id}/aceitar`, payload).then((r: any) => r.data?.data ?? r.data),

  rejeitarNfe: (id: number, motivo: string): Promise<void> =>
    api.post(`${BASE}/nfes/${id}/rejeitar`, { motivo }).then((r: any) => r.data?.data ?? r.data),

  vincularOcNfe: (id: number, oc_id: number): Promise<void> =>
    api.patch(`${BASE}/nfes/${id}/vincular-oc`, { oc_id }).then((r: any) => r.data?.data ?? r.data),

  confirmarMatchItem: (nfeId: number, itemId: number, catalogo_id: number): Promise<void> =>
    api.patch(`${BASE}/nfes/${nfeId}/itens/${itemId}/match`, { catalogo_id }).then((r: any) => r.data?.data ?? r.data),

  // Ordens de Compra
  getOcs: (
    params?: { localDestinoId?: number; status?: string; limit?: number; offset?: number },
  ): Promise<AlmOrdemCompra[]> => {
    const q = new URLSearchParams();
    if (params?.localDestinoId) q.set('local_destino_id', String(params.localDestinoId));
    if (params?.status)         q.set('status',            params.status);
    if (params?.limit)          q.set('limit',             String(params.limit));
    if (params?.offset)         q.set('offset',            String(params.offset));
    return api.get(`${BASE}/ordens-compra${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  getOc: (id: number): Promise<AlmOrdemCompra> =>
    api.get(`${BASE}/ocs/${id}`).then((r: any) => r.data?.data ?? r.data),

  criarOc: (payload: CreateOcPayload): Promise<AlmOrdemCompra> =>
    api.post(`${BASE}/ordens-compra`, payload).then((r: any) => r.data?.data ?? r.data),

  confirmarOc: (id: number): Promise<void> =>
    api.patch(`${BASE}/ocs/${id}/confirmar`, {}).then((r: any) => r.data?.data ?? r.data),

  emitirOc: (id: number): Promise<void> =>
    api.patch(`${BASE}/ocs/${id}/emitir`, {}).then((r: any) => r.data?.data ?? r.data),

  receberOcItens: (ocId: number, itens: ReceberOcItemPayload[]): Promise<void> =>
    api.post(`${BASE}/ocs/${ocId}/receber`, { itens }).then((r: any) => r.data?.data ?? r.data),

  cancelarOc: (id: number): Promise<void> =>
    api.patch(`${BASE}/ocs/${id}/cancelar`, {}).then((r: any) => r.data?.data ?? r.data),

  // Solicitações
  getSolicitacoes: (
    params?: { localDestinoId?: number; status?: string; limit?: number; offset?: number },
  ): Promise<AlmSolicitacao[]> => {
    const q = new URLSearchParams();
    if (params?.localDestinoId) q.set('local_destino_id', String(params.localDestinoId));
    if (params?.status)         q.set('status',            params.status);
    if (params?.limit)          q.set('limit',             String(params.limit));
    if (params?.offset)         q.set('offset',            String(params.offset));
    return api.get(`${BASE}/solicitacoes${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  getSolicitacao: (id: number): Promise<AlmSolicitacao> =>
    api.get(`${BASE}/solicitacoes/${id}`).then((r: any) => r.data?.data ?? r.data),

  criarSolicitacao: (payload: CreateSolicitacaoPayload): Promise<AlmSolicitacao> =>
    api.post(`${BASE}/solicitacoes`, payload).then((r: any) => r.data?.data ?? r.data),

  submeterSolicitacao: (id: number): Promise<void> =>
    api.patch(`${BASE}/solicitacoes/${id}/submeter`, {}).then((r: any) => r.data?.data ?? r.data),

  aprovarSolicitacao: (id: number, payload: AprovarSolicitacaoPayload): Promise<void> =>
    api.post(`${BASE}/solicitacoes/${id}/aprovar`, payload).then((r: any) => r.data?.data ?? r.data),

  cancelarSolicitacao: (id: number): Promise<void> =>
    api.patch(`${BASE}/solicitacoes/${id}/cancelar`, {}).then((r: any) => r.data?.data ?? r.data),

  updateOrcamentoItem: (
    itemId: number,
    dto: { catalogo_id?: number; unidade?: string; quantidade?: number; preco_unitario?: number },
  ): Promise<AlmOrcamentoItem> =>
    api.patch(`${BASE}/orcamentos/itens/${itemId}`, dto).then((r: any) => r.data?.data ?? r.data),

  // Planejamento (Sprint 5)
  getPlanejamento: (obraId: number, mes?: number, ano?: number): Promise<AlmPlanejamentoItem[]> => {
    const q = new URLSearchParams();
    if (mes) q.set('mes', String(mes));
    if (ano) q.set('ano', String(ano));
    return api.get(`${BASE}/obras/${obraId}/planejamento${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  getPlanejamentoPeriodos: (obraId: number): Promise<AlmPlanejamentoPeriodo[]> =>
    api.get(`${BASE}/obras/${obraId}/planejamento/periodos`).then((r: any) => r.data?.data ?? r.data),

  upsertPlanejamento: (
    obraId: number,
    dto: { catalogo_id: number; mes: number; ano: number; quantidade: number; observacao?: string },
  ): Promise<AlmPlanejamentoItem> =>
    api.post(`${BASE}/obras/${obraId}/planejamento`, dto).then((r: any) => r.data?.data ?? r.data),

  removerPlanejamentoItem: (obraId: number, id: number): Promise<void> =>
    api.delete(`${BASE}/obras/${obraId}/planejamento/${id}`).then((r: any) => r.data?.data ?? r.data),

  // IA Preditiva (insights persistidos)
  getInsights: (): Promise<AlmSugestaoIa[]> =>
    api.get(`${BASE}/insights`).then((r: any) => r.data?.data ?? r.data),

  aplicarSugestao: (id: number): Promise<{ solicitacao_id: number }> =>
    api.patch(`${BASE}/insights/${id}/aplicar`).then((r: any) => r.data?.data ?? r.data),

  ignorarSugestao: (id: number): Promise<void> =>
    api.patch(`${BASE}/insights/${id}/ignorar`).then((r: any) => r.data?.data ?? r.data),

  reanalisarInsights: (): Promise<{ enqueued: boolean }> =>
    api.post(`${BASE}/insights/reanalisar`).then((r: any) => r.data?.data ?? r.data),

  // Importação de estoque via planilha
  downloadTemplateEstoque: async (): Promise<void> => {
    const response = await (api as any).get(
      `${BASE}/estoque/importar/template`,
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-importacao-estoque.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  importarEstoque: (localId: number, file: File): Promise<ImportacaoResultado> => {
    const form = new FormData();
    form.append('file', file);
    form.append('local_id', String(localId));
    return api.postForm(`${BASE}/estoque/importar`, form).then((r: any) => r.data?.data ?? r.data);
  },

  // ── Cotações (Sprint A) ────────────────────────────────────────────────────

  criarCotacao: (
    solicitacaoId: number,
    body: { fornecedor_id: number; validade_dias?: number; observacao?: string },
  ): Promise<AlmCotacao> =>
    api.post(`${BASE}/solicitacoes/${solicitacaoId}/cotacoes`, body).then((r: any) => r.data?.data ?? r.data),

  listarCotacoes: (solicitacaoId: number): Promise<AlmCotacao[]> =>
    api.get(`${BASE}/solicitacoes/${solicitacaoId}/cotacoes`).then((r: any) => r.data?.data ?? r.data),

  getCotacao: (id: number): Promise<AlmCotacaoDetalhe> =>
    api.get(`${BASE}/cotacoes/${id}`).then((r: any) => r.data?.data ?? r.data),

  enviarCotacao: (id: number): Promise<{ token: string; link: string }> =>
    api.patch(`${BASE}/cotacoes/${id}/enviar`).then((r: any) => r.data?.data ?? r.data),

  cancelarCotacao: (id: number): Promise<void> =>
    api.delete(`${BASE}/cotacoes/${id}`).then((r: any) => r.data?.data ?? r.data),

  getComparativo: (solicitacaoId: number): Promise<AlmComparativoItem[]> =>
    api.get(`${BASE}/solicitacoes/${solicitacaoId}/cotacoes/comparativo`).then((r: any) => r.data?.data ?? r.data),

  getCurvaAbc: (solicitacaoId: number): Promise<AlmCurvaAbcItem[]> =>
    api.get(`${BASE}/solicitacoes/${solicitacaoId}/cotacoes/curva-abc`).then((r: any) => r.data?.data ?? r.data),

  gerarOcs: (
    solicitacaoId: number,
    body: {
      modo: 'automatico' | 'manual';
      selecoes?: { catalogo_id: number; cotacao_id: number }[];
      local_entrega?: string;
      condicao_pgto_override?: string;
    },
  ): Promise<{ ocs_criadas: number; ids: number[] }> =>
    api.post(`${BASE}/solicitacoes/${solicitacaoId}/cotacoes/gerar-oc`, body).then((r: any) => r.data?.data ?? r.data),

  // Locais
  listarLocais: (filters?: { tipo?: AlmLocalTipo; ativo?: boolean; obra_id?: number }): Promise<AlmLocal[]> =>
    api.get(`${BASE}/locais${buildQuery(filters as Record<string, unknown>)}`).then((r: any) => r.data?.data ?? r.data),

  buscarLocal: (id: number): Promise<AlmLocal> =>
    api.get(`${BASE}/locais/${id}`).then((r: any) => r.data?.data ?? r.data),

  criarLocal: (dto: CreateLocalPayload): Promise<AlmLocal> =>
    api.post(`${BASE}/locais`, dto).then((r: any) => r.data?.data ?? r.data),

  atualizarLocal: (id: number, dto: Partial<CreateLocalPayload>): Promise<AlmLocal> =>
    api.put(`${BASE}/locais/${id}`, dto).then((r: any) => r.data?.data ?? r.data),

  desativarLocal: (id: number): Promise<{ id: number; ativo: boolean }> =>
    api.delete(`${BASE}/locais/${id}`).then((r: any) => r.data?.data ?? r.data),

  // Transferências
  listarTransferencias: (filters?: {
    status?: AlmTransferenciaStatus;
    local_origem_id?: number;
    local_destino_id?: number;
    page?: number;
    per_page?: number;
  }): Promise<{ data: AlmTransferencia[]; total: number; page: number; perPage: number }> =>
    api.get(`${BASE}/transferencias${buildQuery(filters as Record<string, unknown>)}`).then((r: any) => r.data?.data ?? r.data),

  buscarTransferencia: (id: number): Promise<AlmTransferencia> =>
    api.get(`${BASE}/transferencias/${id}`).then((r: any) => r.data?.data ?? r.data),

  criarTransferencia: (dto: CreateTransferenciaPayload): Promise<AlmTransferencia> =>
    api.post(`${BASE}/transferencias`, dto).then((r: any) => r.data?.data ?? r.data),

  aprovarTransferencia: (id: number): Promise<AlmTransferencia> =>
    api.post(`${BASE}/transferencias/${id}/aprovar`, {}).then((r: any) => r.data?.data ?? r.data),

  executarTransferencia: (id: number, dto?: ExecutarTransferenciaPayload): Promise<AlmTransferencia> =>
    api.post(`${BASE}/transferencias/${id}/executar`, dto ?? {}).then((r: any) => r.data?.data ?? r.data),

  cancelarTransferencia: (id: number, motivo?: string): Promise<AlmTransferencia> =>
    api.post(`${BASE}/transferencias/${id}/cancelar`, { motivo }).then((r: any) => r.data?.data ?? r.data),

  // Config de Transferência
  getConfigTransferencia: (): Promise<AlmConfigTransferencia> =>
    api.get(`${BASE}/config-transferencia`).then((r: any) => r.data?.data ?? r.data),

  upsertConfigTransferencia: (dto: { valor_limite_direto: number; roles_aprovadores: string[] }): Promise<AlmConfigTransferencia> =>
    api.put(`${BASE}/config-transferencia`, dto).then((r: any) => r.data?.data ?? r.data),

  // Conversões de Unidade
  listarConversoes: (): Promise<AlmConversao[]> =>
    api.get(`${BASE}/conversoes`).then((r: any) => r.data?.data ?? r.data),

  upsertConversao: (dto: UpsertConversaoPayload): Promise<{ id: number }> =>
    api.post(`${BASE}/conversoes`, dto).then((r: any) => r.data?.data ?? r.data),

  converterUm: (dto: ConverterPayload): Promise<{ quantidade: number; fator: number }> =>
    api.post(`${BASE}/conversoes/converter`, dto).then((r: any) => r.data?.data ?? r.data),

  calcularCompra: (dto: CalcularCompraPayload): Promise<CalcularCompraResult> =>
    api.post(`${BASE}/conversoes/calcular-compra`, dto).then((r: any) => r.data?.data ?? r.data),
};

// ─── Tipos Conversão ──────────────────────────────────────────────────────────

export interface AlmConversao {
  id: number;
  tenant_id: number;
  catalogo_id: number | null;
  catalogo_nome: string | null;
  unidade_origem: string;
  unidade_destino: string;
  fator: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export interface UpsertConversaoPayload {
  catalogoId?: number | null;
  unidadeOrigem: string;
  unidadeDestino: string;
  fator: number;
  descricao?: string | null;
}

export interface ConverterPayload {
  catalogoId?: number | null;
  quantidade: number;
  unidadeOrigem: string;
  unidadeDestino: string;
}

export interface CalcularCompraPayload {
  catalogoId?: number | null;
  necessidade: number;
  unidadeNecessidade: string;
  unidadeCompra: string;
  quebraPct?: number;
}

export interface CalcularCompraResult {
  quantidadeCompra: number;
  quantidadeNominal: number;
  fatorAplicado: number;
  quebraAplicada: number;
}

// ─── Tipos Cotações ───────────────────────────────────────────────────────────

export type AlmCotacaoStatus =
  | 'em_preenchimento' | 'enviada' | 'respondida' | 'selecionada' | 'cancelada';

export interface AlmCotacao {
  id: number;
  solicitacao_id: number;
  fornecedor_id: number;
  fornecedor_nome: string;
  fornecedor_email: string | null;
  status: AlmCotacaoStatus;
  prazo_entrega: string | null;
  condicao_pgto: string | null;
  frete: number;
  subtotal: number | null;
  respondida_at: string | null;
  token_expires_at: string | null;
  created_at: string;
  total_itens?: number;
  itens_respondidos?: number;
}

export interface AlmCotacaoItem {
  id: number;
  catalogo_id: number;
  catalogo_nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number | null;
  marca: string | null;
  disponivel: boolean;
  prazo_dias: number | null;
  observacao: string | null;
}

export interface AlmCotacaoDetalhe extends AlmCotacao {
  itens: AlmCotacaoItem[];
}

export interface AlmComparativoItem {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  quantidade: number;
  propostas: {
    cotacao_id: number;
    fornecedor_id: number;
    fornecedor_nome: string;
    preco_unitario: number | null;
    prazo_dias: number | null;
    disponivel: boolean;
    total_item: number | null;
    melhor_preco: boolean;
  }[];
  menor_preco: number | null;
  melhor_cotacao_id: number | null;
  economia_pct: number | null;
}

export interface AlmCurvaAbcItem {
  catalogo_id: number;
  catalogo_nome: string;
  valor_total: number;
  percentual: number;
  percentual_acumulado: number;
  classificacao: 'A' | 'B' | 'C';
}
