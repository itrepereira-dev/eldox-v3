// backend/src/almoxarifado/types/alm.types.ts

// ── Enums ──────────────────────────────────────────────────────────────────────

export type AlmMovimentoTipo =
  | 'entrada' | 'saida' | 'transferencia' | 'perda' | 'ajuste';

export type AlmSolicitacaoStatus =
  | 'rascunho' | 'aguardando_aprovacao' | 'em_aprovacao'
  | 'aprovada' | 'reprovada' | 'cancelada';

export type AlmOcStatus =
  | 'rascunho' | 'confirmada' | 'emitida'
  | 'parcialmente_recebida' | 'recebida' | 'cancelada';

export type AlmNfeStatus =
  | 'pendente_match' | 'match_parcial' | 'match_ok'
  | 'aceita' | 'rejeitada' | 'sem_oc';

export type AlmMatchStatus = 'auto' | 'pendente' | 'sem_match' | 'confirmado_manual';

export type AlmNivelAlerta = 'critico' | 'atencao';

export type AlmTipoAlerta = 'estoque_minimo' | 'reposicao_prevista' | 'anomalia';

// ── Estoque ────────────────────────────────────────────────────────────────────

export interface AlmEstoqueLocal {
  id: number;
  tenant_id: number;
  obra_id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: Date;
}

export interface AlmEstoqueSaldo {
  id: number;
  tenant_id: number;
  obra_id: number;
  catalogo_id: number;
  local_id: number | null;
  quantidade: number;
  estoque_min: number;
  unidade: string;
  updated_at: Date;
  // joins
  catalogo_nome?: string;
  catalogo_codigo?: string;
  local_nome?: string | null;
  nivel?: 'critico' | 'atencao' | 'normal';
}

export interface AlmMovimento {
  id: number;
  tenant_id: number;
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
  created_at: Date;
  // joins
  catalogo_nome?: string;
  local_nome?: string | null;
  usuario_nome?: string | null;
}

// ── Orçamento ─────────────────────────────────────────────────────────────────

export interface AlmOrcamentoVersao {
  id: number;
  tenant_id: number;
  obra_id: number;
  versao: number;
  nome: string | null;
  ativo: boolean;
  importado_por: number | null;
  created_at: Date;
  total_itens?: number;
}

export interface AlmOrcamentoItem {
  id: number;
  tenant_id: number;
  versao_id: number;
  catalogo_id: number | null;
  descricao_orig: string;
  unidade: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  mes_previsto: number | null;
  etapa: string | null;
  // joins
  catalogo_nome?: string | null;
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export interface AlmAlertaEstoque {
  id: number;
  tenant_id: number;
  obra_id: number;
  catalogo_id: number;
  local_id: number | null;
  tipo: AlmTipoAlerta;
  nivel: AlmNivelAlerta;
  mensagem: string;
  lido: boolean;
  lido_por: number | null;
  lido_at: Date | null;
  criado_at: Date;
  // joins
  catalogo_nome?: string;
}

// ── Planejamento ──────────────────────────────────────────────────────────────

export interface AlmPlanejamentoItem {
  id: number;
  tenant_id: number;
  obra_id: number;
  catalogo_id: number;
  mes: number;
  ano: number;
  quantidade: number;
  unidade: string;
  observacao: string | null;
  criado_por: number | null;
  created_at: Date;
  updated_at: Date;
  // joins
  catalogo_nome?: string;
  catalogo_codigo?: string | null;
  consumo_realizado?: number;   // soma das saídas do mês
}

// ── IA Insights ───────────────────────────────────────────────────────────────

export interface AlmReorderPrediction {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  quantidade_atual: number;
  consumo_medio_diario: number;
  dias_restantes: number;       // quantidade_atual / consumo_medio_diario
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
  fator_desvio: number;         // consumo_recente / consumo_medio
  nivel: 'critico' | 'atencao';
  explicacao_ia: string;
  obra_id: number;
}

export interface AlmInsightsResult {
  reorder: AlmReorderPrediction[];
  anomalias: AlmAnomaliaDetectada[];
  analisado_em: Date;
  modelo: string;
}

// ── Notas Fiscais ─────────────────────────────────────────────────────────────

export interface AlmNfeWebhook {
  id: number;
  tenant_id: number | null;
  chave_nfe: string;
  payload_raw: Record<string, unknown>;
  status: 'pendente' | 'processando' | 'processado' | 'erro' | 'dlq';
  tentativas: number;
  erro_msg: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AlmNotaFiscal {
  id: number;
  tenant_id: number;
  obra_id: number | null;
  oc_id: number | null;
  webhook_id: number | null;
  chave_nfe: string;
  numero: string | null;
  serie: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  data_emissao: Date | null;
  valor_total: number | null;
  xml_url: string | null;
  status: AlmNfeStatus;
  aceito_por: number | null;
  aceito_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // joins
  oc_numero?: string | null;
  aceito_por_nome?: string | null;
  total_itens?: number;
  itens?: AlmNfeItem[];
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
  confirmado_at: Date | null;
  created_at: Date;
  // joins
  catalogo_nome?: string | null;
}

export interface AiSugestaoMatch {
  catalogo_id: number;
  nome: string;
  score: number;    // 0-1
  motivo: string;
}

// ── Ordens de Compra ──────────────────────────────────────────────────────────

export interface AlmOrdemCompra {
  id: number;
  tenant_id: number;
  obra_id: number;
  solicitacao_id: number | null;
  fornecedor_id: number;
  numero: string; // generated: 'OC-001'
  status: AlmOcStatus;
  valor_total: number | null;
  prazo_entrega: Date | null;
  condicao_pgto: string | null;
  local_entrega: string | null;
  observacoes: string | null;
  pdf_url: string | null;
  version: number;
  criado_por: number | null;
  created_at: Date;
  updated_at: Date;
  // joins
  fornecedor_nome?: string;
  criado_por_nome?: string | null;
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
  created_at: Date;
  // joins
  catalogo_nome?: string;
  catalogo_codigo?: string | null;
}

// ── Solicitações ──────────────────────────────────────────────────────────────

export interface AlmSolicitacao {
  id: number;
  tenant_id: number;
  obra_id: number;
  numero: number;
  descricao: string;
  status: AlmSolicitacaoStatus;
  urgente: boolean;
  data_necessidade: Date | null;
  servico_ref: string | null;
  etapa_atual: number;
  solicitante_id: number | null;
  created_at: Date;
  updated_at: Date;
  // joins
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
  created_at: Date;
  // joins
  catalogo_nome?: string;
  catalogo_codigo?: string | null;
}

export interface AlmAprovacao {
  id: number;
  tenant_id: number;
  solicitacao_id: number;
  etapa: number;
  acao: 'aprovado' | 'reprovado' | 'cancelado';
  aprovador_id: number | null;
  observacao: string | null;
  created_at: Date;
  // joins
  aprovador_nome?: string | null;
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

export interface AlmDashboardKpis {
  itens_estoque_minimo: number;
  solicitacoes_pendentes: number;
  nfe_aguardando_match: number;
  valor_oc_aberto: number;
  conformidade_recebimento_pct: number;
}
