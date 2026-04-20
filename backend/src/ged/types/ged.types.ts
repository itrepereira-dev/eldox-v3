// src/ged/types/ged.types.ts
// Interfaces TypeScript para retorno das queries raw do GED

export type GedEscopo = 'EMPRESA' | 'OBRA';

export type GedStatusVersao =
  | 'RASCUNHO'
  | 'IFA'
  | 'IFC'
  | 'IFP'
  | 'AS_BUILT'
  | 'REJEITADO'
  | 'OBSOLETO'
  | 'CANCELADO';

export type GedStatusEmissao = 'VIGENTE' | 'OBSOLETO' | null;

export type GedAcaoAudit =
  | 'UPLOAD'
  | 'SUBMISSAO'
  | 'APROVACAO'
  | 'REJEICAO'
  | 'DOWNLOAD'
  | 'VIGENCIA'
  | 'OBSOLESCENCIA'
  | 'QR_SCAN'
  | 'CANCELAMENTO'
  | 'WORKFLOW_STEP';

export type GedWorkflowTipo = 'SEQUENCIAL' | 'PARALELO' | 'AD_HOC' | 'LIVRE';

export type GedTransmittalStatus =
  | 'RASCUNHO'
  | 'ENVIADO'
  | 'RESPONDIDO'
  | 'VENCIDO';

export type GedTransmittalFinalidade =
  | 'PARA_APROVACAO'
  | 'PARA_INFORMACAO'
  | 'PARA_CONSTRUCAO'
  | 'PARA_COMPRA';

export interface GedDocumento {
  id: number;
  tenant_id: number;
  escopo: GedEscopo;
  obra_id: number | null;
  pasta_id: number | null;
  titulo: string;
  codigo: string;
  disciplina: string | null;
  tags: string[] | null;
  criado_em: Date;
  atualizado_em: Date;
  deletado_em: Date | null;
}

export interface GedVersao {
  id: number;
  documento_id: number;
  numero_revisao: string;
  version: number;
  status: GedStatusVersao;
  status_emissao: GedStatusEmissao;
  storage_key: string;
  storage_bucket: string;
  mime_type: string;
  tamanho_bytes: number;
  checksum_sha256: string;
  nome_original: string;
  ocr_texto: string | null;
  ai_categorias: string[] | null;
  ai_confianca: number | null;
  ai_metadata: Record<string, unknown> | null;
  criado_por: number;
  aprovado_por: number | null;
  aprovado_em: Date | null;
  workflow_template_id: number | null;
  workflow_step_atual: number | null;
  qr_token: string;
  criado_em: Date;
  atualizado_em: Date;
}

export interface GedAuditLog {
  id: number;
  tenant_id: number;
  versao_id: number;
  usuario_id: number;
  acao: GedAcaoAudit;
  status_de: GedStatusVersao | null;
  status_para: GedStatusVersao | null;
  ip_origem: string | null;
  detalhes: Record<string, unknown> | null;
  criado_em: Date;
}

export interface GedCategoria {
  id: number;
  tenant_id: number;
  nome: string;
  codigo: string;
  escopo_padrao: GedEscopo;
  requer_aprovacao: boolean;
  prazo_revisao_dias: number | null;
  workflow_default_id: number | null;
}

export interface GedPasta {
  id: number;
  tenant_id: number;
  escopo: GedEscopo;
  obra_id: number | null;
  parent_id: number | null;
  nome: string;
  path: string;
  nivel: number;
  configuracoes: Record<string, unknown> | null;
  settings_efetivos: Record<string, unknown> | null;
}

export interface GedWorkflowTemplate {
  id: number;
  tenant_id: number;
  nome: string;
  tipo: GedWorkflowTipo;
}

export interface GedWorkflowStep {
  id: number;
  template_id: number;
  ordem: number;
  nome: string;
  role_minima: string;
  obrigatorio: boolean;
  prazo_horas: number | null;
  condicao_avanco: string | null;
  acao_timeout: string | null;
}

export interface GedWorkflowExecucao {
  id: number;
  tenant_id: number;
  versao_id: number;
  template_id: number;
  step_id: number;
  usuario_id: number;
  acao: string;
  comentario: string | null;
  criado_em: Date;
}

// ged_configuracoes usa tenant_id como PK — sem coluna `id`.
export interface GedConfiguracao {
  tenant_id: number;
  modo_auditoria: boolean;
  workflow_obrigatorio: boolean;
  qr_code_ativo: boolean;
  ocr_ativo: boolean;
  whatsapp_ativo: boolean;
  storage_limite_gb: number;
}

export interface GedTransmittal {
  id: number;
  tenant_id: number;
  obra_id: number;
  numero: string;
  assunto: string;
  status: GedTransmittalStatus;
  criado_por: number;
  transmittal_anterior_id: number | null;
  criado_em: Date;
}

export interface GedTransmittalItem {
  id: number;
  transmittal_id: number;
  versao_id: number;
  finalidade: GedTransmittalFinalidade;
}

export interface GedTransmittalDestinatario {
  id: number;
  transmittal_id: number;
  usuario_id: number | null;
  email_externo: string | null;
  whatsapp: string | null;
  canal: string;
  token_acesso: string;
}

export interface GedCompartilhamento {
  id: number;
  tenant_id: number;
  documento_id: number;
  obra_id: number;
  compartilhado_por: number;
  criado_em: Date;
}

// Tipos compostos para retornos de listagem e detalhe

export interface GedDocumentoComVersaoAtiva extends GedDocumento {
  versao_atual_id: number | null;
  versao_atual_status: GedStatusVersao | null;
  versao_atual_numero: string | null;
  versao_atual_version: number | null;
}

export interface GedListaMestraItem {
  documento_id: number;
  titulo: string;
  codigo: string;
  disciplina: string | null;
  pasta_path: string | null;
  versao_id: number;
  numero_revisao: string;
  version: number;
  status: GedStatusVersao;
  aprovado_por: number | null;
  aprovado_em: Date | null;
  qr_token: string;
}

export interface GedUploadResult {
  documentoId: number;
  versaoId: number;
  codigoGerado: string;
  status: GedStatusVersao;
  qrToken: string;
}

export interface GedDownloadResult {
  presignedUrl: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  expiresInSeconds: number;
}
