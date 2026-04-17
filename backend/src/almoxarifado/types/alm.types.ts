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

// ── NEW: Location types ────────────────────────────────────────────────────────

export type AlmLocalTipo = 'CENTRAL' | 'CD' | 'DEPOSITO' | 'OBRA';

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
  created_at: Date;
  updated_at: Date;
  // optional join
  obra_nome?: string | null;
}

// ── NEW: Transfer types ────────────────────────────────────────────────────────

export type AlmTransferenciaStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'executada'
  | 'cancelada';

export interface AlmTransferenciaItem {
  id: number;
  transferencia_id: number;
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  qtd_executada: number;
  // optional join
  catalogo_nome?: string | null;
}

export interface AlmTransferencia {
  id: number;
  tenant_id: number;
  local_origem_id: number;
  local_destino_id: number;
  status: AlmTransferenciaStatus;
  valor_total: number | null;
  solicitante_id: number;
  aprovador_id: number | null;
  aprovado_at: Date | null;
  observacao: string | null;
  executada_parcial: boolean;
  created_at: Date;
  updated_at: Date;
  // optional joins
  local_origem_nome?: string;
  local_destino_nome?: string;
  itens?: AlmTransferenciaItem[];
}

// ── NEW: Config de Transferência ───────────────────────────────────────────────

export interface AlmConfigTransferencia {
  id: number | null;
  tenant_id: number;
  valor_limite_direto: number;
  roles_aprovadores: string[];
  created_at: Date | null;
  updated_at: Date | null;
}

// ── UPDATED: Estoque (obra_id removed, local_id is now NOT NULL) ───────────────

export interface AlmEstoqueSaldo {
  id: number;
  tenant_id: number;
  catalogo_id: number;
  local_id: number;           // NOT NULL — was nullable + obra_id previously
  quantidade: number;
  estoque_min: number;
  unidade: string;
  updated_at: Date;
  // joins
  catalogo_nome?: string;
  catalogo_codigo?: string;
  local_nome?: string | null;
  local_tipo?: AlmLocalTipo | null;
  nivel?: 'critico' | 'atencao' | 'normal';
}

export interface AlmMovimento {
  id: number;
  tenant_id: number;
  catalogo_id: number;
  local_id: number;           // NOT NULL — was nullable + obra_id previously
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
  local_tipo?: AlmLocalTipo | null;
  usuario_nome?: string | null;
}

// ── UPDATED: Alertas (obra_id removed, local_id is now NOT NULL) ──────────────

export interface AlmAlertaEstoque {
  id: number;
  tenant_id: number;
  catalogo_id: number;
  local_id: number;           // NOT NULL — replaced obra_id
  tipo: AlmTipoAlerta;
  nivel: AlmNivelAlerta;
  mensagem: string;
  lido: boolean;
  lido_por: number | null;
  lido_at: Date | null;
  criado_at: Date;
  // joins
  catalogo_nome?: string;
  local_nome?: string | null;
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
  consumo_realizado?: number;
}

// ── IA Insights ───────────────────────────────────────────────────────────────

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
  local_id: number;           // replaced obra_id
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
  local_id: number;           // replaced obra_id
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
  local_id: number | null;    // nullable until aceita; replaced obra_id
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
  local_nome?: string | null;
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
  score: number;
  motivo: string;
}

// ── UPDATED: Ordens de Compra (local_destino_id replaces obra_id) ─────────────

export interface AlmOrdemCompra {
  id: number;
  tenant_id: number;
  local_destino_id: number;   // replaced obra_id
  solicitacao_id: number | null;
  fornecedor_id: number;
  numero: string;
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
  catalogo_nome?: string;
  catalogo_codigo?: string | null;
}

// ── UPDATED: Solicitações (local_destino_id replaces obra_id) ─────────────────

export interface AlmSolicitacao {
  id: number;
  tenant_id: number;
  local_destino_id: number;   // replaced obra_id
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
  catalogo_nome?: string;
  catalogo_codigo?: string | null;
}

export interface AlmAprovacao {
  id: number;
  solicitacao_id: number;
  etapa: number;
  acao: 'aprovado' | 'reprovado' | 'cancelado';
  aprovador_id: number | null;
  observacao: string | null;
  created_at: Date;
  aprovador_nome?: string | null;
}

// ── IA Sugestões ──────────────────────────────────────────────────────────────

export type AlmSugestaoStatus = 'pendente' | 'aplicado' | 'ignorado';
export type AlmSugestaoTipo   = 'reorder' | 'anomalia';

export interface AlmSugestaoIa {
  id:            number;
  tenant_id:     number;
  tipo:          AlmSugestaoTipo;
  catalogo_id:   number;
  catalogo_nome: string;
  local_id:      number;
  unidade:       string;
  dados_json:    AlmReorderPrediction | AlmAnomaliaDetectada;
  status:        AlmSugestaoStatus;
  solicitacao_id?: number;
  criado_em:     Date;
  atualizado_em: Date;
}
