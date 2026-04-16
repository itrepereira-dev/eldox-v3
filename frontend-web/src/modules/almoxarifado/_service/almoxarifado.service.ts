// frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts
import { api } from '@/services/api';

const BASE = 'almoxarifado';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AlmMovimentoTipo = 'entrada' | 'saida' | 'transferencia' | 'perda' | 'ajuste';
export type AlmNivelAlerta   = 'critico' | 'atencao' | 'normal';
export type AlmTipoAlerta    = 'estoque_minimo' | 'reposicao_prevista' | 'anomalia';

export type AlmSolicitacaoStatus =
  | 'rascunho' | 'aguardando_aprovacao' | 'em_aprovacao'
  | 'aprovada' | 'reprovada' | 'cancelada';

export type AlmOcStatus =
  | 'rascunho' | 'confirmada' | 'emitida'
  | 'parcialmente_recebida' | 'recebida' | 'cancelada';

export type AlmNfeStatus =
  | 'pendente_match' | 'match_parcial' | 'match_ok' | 'aceita' | 'rejeitada' | 'sem_oc';

export interface AlmEstoqueLocal {
  id: number;
  obra_id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export interface AlmEstoqueSaldo {
  id: number;
  obra_id: number;
  catalogo_id: number;
  local_id: number | null;
  quantidade: number;
  estoque_min: number;
  unidade: string;
  catalogo_nome: string;
  catalogo_codigo: string | null;
  local_nome: string | null;
  nivel: AlmNivelAlerta;
  updated_at: string;
}

export interface AlmMovimento {
  id: number;
  obra_id: number;
  catalogo_id: number;
  local_id: number | null;
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
  usuario_nome: string | null;
}

export interface AlmAlertaEstoque {
  id: number;
  obra_id: number;
  catalogo_id: number;
  local_id: number | null;
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
}

export interface AlmNotaFiscal {
  id: number;
  obra_id: number | null;
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
  total_itens?: number;
  itens?: AlmNfeItem[];
}

export interface AlmOrdemCompra {
  id: number;
  obra_id: number;
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
  obra_id: number;
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
  obra_id: number;
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
  obra_id: number;
}

export interface AlmInsightsResult {
  reorder: AlmReorderPrediction[];
  anomalias: AlmAnomaliaDetectada[];
  analisado_em: string;
  modelo: string;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateOcItemPayload {
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  preco_unitario?: number;
}

export interface CreateOcPayload {
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
  local_id?: number;
}

export interface CreateSolicitacaoItemPayload {
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  observacao?: string;
}

export interface CreateSolicitacaoPayload {
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
  catalogo_id: number;
  tipo: AlmMovimentoTipo;
  quantidade: number;
  unidade: string;
  local_id?: number;
  referencia_tipo?: string;
  referencia_id?: number;
  observacao?: string;
}

export interface TransferenciaPayload {
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  local_origem_id?: number;
  obra_destino_id: number;
  local_destino_id?: number;
  observacao?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const almoxarifadoService = {

  // Dashboard
  getDashboardKpis: (obraId: number): Promise<AlmDashboardKpis> =>
    api.get(`${BASE}/obras/${obraId}/dashboard`).then((r: any) => r.data?.data ?? r.data),

  // Locais
  getLocais: (obraId: number): Promise<AlmEstoqueLocal[]> =>
    api.get(`${BASE}/obras/${obraId}/estoque/locais`).then((r: any) => r.data?.data ?? r.data),

  createLocal: (obraId: number, dto: { nome: string; descricao?: string }): Promise<AlmEstoqueLocal> =>
    api.post(`${BASE}/obras/${obraId}/estoque/locais`, dto).then((r: any) => r.data?.data ?? r.data),

  // Estoque (saldo)
  getSaldo: (
    obraId: number,
    params?: { localId?: number; catalogoId?: number; nivel?: string },
  ): Promise<AlmEstoqueSaldo[]> => {
    const q = new URLSearchParams();
    if (params?.localId)    q.set('localId',    String(params.localId));
    if (params?.catalogoId) q.set('catalogoId', String(params.catalogoId));
    if (params?.nivel)      q.set('nivel',      params.nivel);
    return api.get(`${BASE}/obras/${obraId}/estoque${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  // Movimentos
  getMovimentos: (
    obraId: number,
    params?: { catalogoId?: number; tipo?: string; limit?: number; offset?: number },
  ): Promise<AlmMovimento[]> => {
    const q = new URLSearchParams();
    if (params?.catalogoId) q.set('catalogoId', String(params.catalogoId));
    if (params?.tipo)       q.set('tipo',       params.tipo);
    if (params?.limit)      q.set('limit',      String(params.limit));
    if (params?.offset)     q.set('offset',     String(params.offset));
    return api.get(`${BASE}/obras/${obraId}/estoque/movimentos${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  registrarMovimento: (obraId: number, payload: CreateMovimentoPayload): Promise<AlmMovimento> =>
    api.post(`${BASE}/obras/${obraId}/estoque/movimentos`, payload).then((r: any) => r.data?.data ?? r.data),

  transferir: (obraId: number, payload: TransferenciaPayload): Promise<void> =>
    api.post(`${BASE}/obras/${obraId}/estoque/transferencias`, payload).then((r: any) => r.data?.data ?? r.data),

  // Alertas
  getAlertas: (obraId: number, todos = false): Promise<AlmAlertaEstoque[]> =>
    api.get(`${BASE}/obras/${obraId}/estoque/alertas${todos ? '?todos=true' : ''}`).then((r: any) => r.data?.data ?? r.data),

  marcarAlertaLido: (alertaId: number): Promise<void> =>
    api.patch(`${BASE}/estoque/alertas/${alertaId}/ler`, {}).then((r: any) => r.data?.data ?? r.data),

  marcarTodosLidos: (obraId: number): Promise<void> =>
    api.patch(`${BASE}/obras/${obraId}/estoque/alertas/ler-todos`, {}).then((r: any) => r.data?.data ?? r.data),

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
    obraId: number,
    params?: { status?: string; limit?: number; offset?: number },
  ): Promise<AlmNotaFiscal[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit)  q.set('limit',  String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get(`${BASE}/obras/${obraId}/nfes${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  getNfe: (id: number): Promise<AlmNotaFiscal> =>
    api.get(`${BASE}/nfes/${id}`).then((r: any) => r.data?.data ?? r.data),

  aceitarNfe: (id: number, payload?: { oc_id?: number; observacao?: string }): Promise<void> =>
    api.post(`${BASE}/nfes/${id}/aceitar`, payload ?? {}).then((r: any) => r.data?.data ?? r.data),

  rejeitarNfe: (id: number, motivo: string): Promise<void> =>
    api.post(`${BASE}/nfes/${id}/rejeitar`, { motivo }).then((r: any) => r.data?.data ?? r.data),

  vincularOcNfe: (id: number, oc_id: number): Promise<void> =>
    api.patch(`${BASE}/nfes/${id}/vincular-oc`, { oc_id }).then((r: any) => r.data?.data ?? r.data),

  confirmarMatchItem: (nfeId: number, itemId: number, catalogo_id: number): Promise<void> =>
    api.patch(`${BASE}/nfes/${nfeId}/itens/${itemId}/match`, { catalogo_id }).then((r: any) => r.data?.data ?? r.data),

  // Ordens de Compra
  getOcs: (
    obraId: number,
    params?: { status?: string; limit?: number; offset?: number },
  ): Promise<AlmOrdemCompra[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit)  q.set('limit',  String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get(`${BASE}/obras/${obraId}/ocs${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  getOc: (id: number): Promise<AlmOrdemCompra> =>
    api.get(`${BASE}/ocs/${id}`).then((r: any) => r.data?.data ?? r.data),

  criarOc: (obraId: number, payload: CreateOcPayload): Promise<AlmOrdemCompra> =>
    api.post(`${BASE}/obras/${obraId}/ocs`, payload).then((r: any) => r.data?.data ?? r.data),

  confirmarOc: (id: number): Promise<void> =>
    api.patch(`${BASE}/ocs/${id}/confirmar`, {}).then((r: any) => r.data?.data ?? r.data),

  emitirOc: (id: number): Promise<void> =>
    api.patch(`${BASE}/ocs/${id}/emitir`, {}).then((r: any) => r.data?.data ?? r.data),

  receberOcItens: (obraId: number, ocId: number, itens: ReceberOcItemPayload[]): Promise<void> =>
    api.post(`${BASE}/obras/${obraId}/ocs/${ocId}/receber`, { itens }).then((r: any) => r.data?.data ?? r.data),

  cancelarOc: (id: number): Promise<void> =>
    api.patch(`${BASE}/ocs/${id}/cancelar`, {}).then((r: any) => r.data?.data ?? r.data),

  // Solicitações
  getSolicitacoes: (
    obraId: number,
    params?: { status?: string; limit?: number; offset?: number },
  ): Promise<AlmSolicitacao[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit)  q.set('limit',  String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get(`${BASE}/obras/${obraId}/solicitacoes${q.toString() ? '?' + q : ''}`).then((r: any) => r.data?.data ?? r.data);
  },

  getSolicitacao: (id: number): Promise<AlmSolicitacao> =>
    api.get(`${BASE}/solicitacoes/${id}`).then((r: any) => r.data?.data ?? r.data),

  criarSolicitacao: (obraId: number, payload: CreateSolicitacaoPayload): Promise<AlmSolicitacao> =>
    api.post(`${BASE}/obras/${obraId}/solicitacoes`, payload).then((r: any) => r.data?.data ?? r.data),

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

  // IA Insights (Sprint 5)
  getInsights: (obraId: number): Promise<AlmInsightsResult> =>
    api.get(`${BASE}/obras/${obraId}/insights`).then((r: any) => r.data?.data ?? r.data),

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
};

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
