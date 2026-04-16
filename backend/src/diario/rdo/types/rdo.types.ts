// backend/src/diario/rdo/types/rdo.types.ts

export type RdoStatus = 'preenchendo' | 'revisao' | 'aprovado' | 'cancelado';

export type PeriodoDia = 'manha' | 'tarde' | 'noite';

export type CondicaoClima =
  | 'ensolarado'
  | 'nublado'
  | 'chuvoso'
  | 'parcialmente_nublado'
  | 'tempestade';

export type TipoMaoObra = 'proprio' | 'subcontratado' | 'terceirizado';

export type TipoOcorrencia =
  | 'acidente'
  | 'incidente'
  | 'quase_acidente'
  | 'paralisa_servico'
  | 'problema_material'
  | 'problema_projeto'
  | 'interferencia'
  | 'outros';

export type AcaoSugestaoIa = 'aplicou' | 'ignorou' | 'editou';

// ─── Entidades principais ────────────────────────────────────────────────────

export interface Rdo {
  id: number;
  tenant_id: number;
  obra_id: number;
  data: string; // YYYY-MM-DD
  status: RdoStatus;
  numero_sequencial?: number;
  criado_por: number;
  aprovado_por?: number;
  aprovado_em?: Date;
  resumo_ia?: string;
  pdf_url?: string;
  deleted_at?: Date;
  criado_em: Date;
  atualizado_em: Date;
}

export interface RdoClima {
  id: number;
  rdo_id: number;
  tenant_id: number;
  periodo: PeriodoDia;
  condicao: CondicaoClima;
  praticavel: boolean;
  chuva_mm?: number;
  aplicado_pelo_usuario: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

export interface RdoMaoObra {
  id: number;
  rdo_id: number;
  tenant_id: number;
  funcao: string;
  quantidade: number;
  tipo: TipoMaoObra;
  nome_personalizado?: string;
  hora_entrada?: string; // HH:MM
  hora_saida?: string;   // HH:MM
  criado_em: Date;
}

export interface RdoEquipamento {
  id: number;
  rdo_id: number;
  tenant_id: number;
  descricao: string;
  quantidade: number;
  unidade?: string;
  observacao?: string;
  criado_em: Date;
}

export interface RdoAtividade {
  id: number;
  rdo_id: number;
  tenant_id: number;
  descricao: string;
  pavimento?: string;
  servico?: string;
  percentual_executado?: number;
  observacao?: string;
  criado_em: Date;
}

export interface RdoOcorrencia {
  id: number;
  rdo_id: number;
  tenant_id: number;
  tipo: TipoOcorrencia;
  descricao: string;
  grau_impacto?: 'baixo' | 'medio' | 'alto' | 'critico';
  acao_tomada?: string;
  criado_em: Date;
}

export interface RdoChecklistItem {
  id: number;
  rdo_id: number;
  tenant_id: number;
  item: string;
  resposta: boolean;
  observacao?: string;
  criado_em: Date;
}

export interface RdoFoto {
  id: number;
  rdo_id: number;
  tenant_id: number;
  ged_versao_id?: number;
  url?: string;
  descricao?: string;
  legenda?: string;
  criado_por: number;
  criado_em: Date;
}

export interface RdoAssinatura {
  id: number;
  rdo_id: number;
  tenant_id: number;
  usuario_id: number;
  assinatura_base64: string;
  tipo: 'responsavel' | 'aprovador';
  criado_em: Date;
}

export interface RdoLogEdicao {
  id: number;
  rdo_id: number;
  tenant_id: number;
  usuario_id: number;
  campo: string;
  valor_anterior?: any;
  valor_novo?: any;
  acao: string;
  criado_em: Date;
}

export interface RdoSugestaoIa {
  id: number;
  rdo_id: number;
  tenant_id: number;
  agente: string;
  campo: string;
  valor_sugerido: any;
  valor_aplicado?: any;
  acao?: AcaoSugestaoIa;
  aplicado_em?: Date;
  usuario_id?: number;
  criado_em: Date;
}

// ─── Tipos compostos (responses) ─────────────────────────────────────────────

export interface RdoCompleto extends Rdo {
  clima: RdoClima[];
  mao_obra: RdoMaoObra[];
  equipamentos: RdoEquipamento[];
  atividades: RdoAtividade[];
  ocorrencias: RdoOcorrencia[];
  checklist: RdoChecklistItem[];
  fotos: RdoFoto[];
  assinaturas: RdoAssinatura[];
  log_edicoes: RdoLogEdicao[];
}

export interface RdoListItem extends Rdo {
  obra_nome?: string;
}

export interface RdoListResponse {
  data: RdoListItem[];
  total: number;
  page: number;
  limit: number;
  status_counts: Record<RdoStatus, number>;
}

export interface RdoCreateResponse {
  rdo_id: number;
  status: RdoStatus;
  sugestoes_ia: {
    clima: any | null;
    equipe: any | null;
    atividades: any | null;
  } | null;
}

export interface RdoStatusResponse {
  rdo_id: number;
  status: RdoStatus;
  resumo_ia?: string;
  pdf_url?: string;
}

export interface RdoValidacaoResponse {
  pode_enviar: boolean;
  inconsistencias: RdoInconsistencia[];
}

export interface RdoInconsistencia {
  campo: string;
  mensagem: string;
  severidade: 'erro' | 'aviso';
  codigo: string;
}

export interface RdoInteligenciaObra {
  risco_atraso_pct: number;
  tendencia: 'melhora' | 'estavel' | 'piora';
  dias_sem_relatorio: number;
  top_ocorrencias: Array<{ tipo: TipoOcorrencia; contagem: number }>;
  previsao_conclusao_ia?: string; // ISO date
}

export interface WhatsappWebhookResponse {
  acao: string;
  rdo_id?: number;
  resumo_para_usuario: string;
  campos_extraidos: Record<string, any>;
}

// ─── BullMQ Job Payloads ──────────────────────────────────────────────────────

export interface JobAcionarAgentesIa {
  rdoId: number;
  tenantId: number;
  usuarioId: number;
}

export interface JobGerarResumoIa {
  rdoId: number;
  tenantId: number;
}

export interface JobGerarPdf {
  rdoId: number;
  tenantId: number;
}

export interface JobEnviarAlerta {
  tenantId: number;
  tipo: string;
  obras_afetadas: number[];
}
