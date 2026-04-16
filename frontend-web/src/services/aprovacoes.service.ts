import { api } from './api';

export type AprovacaoStatus = 'PENDENTE' | 'EM_APROVACAO' | 'APROVADO' | 'REPROVADO' | 'CANCELADO';
export type AprovacaoModulo = 'FVS' | 'FVM' | 'RDO' | 'NC' | 'GED' | 'ENSAIO' | 'CONCRETAGEM' | 'ALMOXARIFADO';
export type TipoAprovador = 'RESPONSAVEL_OBRA' | 'ROLE' | 'USUARIO_FIXO';
export type AcaoVencimento = 'ESCALAR' | 'AVANCAR' | 'BLOQUEAR';
export type AcaoRejeicao = 'RETORNAR_SOLICITANTE' | 'RETORNAR_ETAPA_1' | 'RETORNAR_ETAPA_ANTERIOR' | 'BLOQUEAR';

export interface WorkflowTemplateEtapa {
  id: number;
  templateId: number;
  ordem: number;
  nome: string;
  tipoAprovador: TipoAprovador;
  role?: string;
  usuarioFixoId?: number;
  condicao?: string;
  prazoHoras?: number;
  acaoVencimento: AcaoVencimento;
  acaoRejeicao: AcaoRejeicao;
}

export interface WorkflowTemplate {
  id: number;
  tenantId: number;
  nome: string;
  modulo: AprovacaoModulo;
  descricao?: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  etapas: WorkflowTemplateEtapa[];
}

export interface AprovacaoDecisao {
  id: number;
  instanciaId: number;
  etapaOrdem?: number;
  tipo: string;
  decisao?: 'APROVADO' | 'REPROVADO';
  observacao?: string;
  aprovadorId?: number;
  aprovador?: { id: number; nome: string; email: string };
  criadoEm: string;
}

export interface AprovacaoInstancia {
  id: number;
  tenantId: number;
  templateId: number;
  template?: WorkflowTemplate;
  modulo: AprovacaoModulo;
  entidadeId: number;
  titulo: string;
  obraId?: number;
  obra?: { id: number; nome: string };
  solicitanteId: number;
  solicitante?: { id: number; nome: string; email: string };
  aprovadorAtualId?: number;
  aprovadorAtual?: { id: number; nome: string; email: string };
  etapaAtual?: number;
  status: AprovacaoStatus;
  snapshotJson?: Record<string, unknown>;
  prazo?: string;
  criadoEm: string;
  atualizadoEm: string;
  decisoes?: AprovacaoDecisao[];
}

export interface SolicitarAprovacaoDto {
  templateId: number;
  modulo: AprovacaoModulo;
  entidadeId: number;
  titulo: string;
  obraId?: number;
  prazo?: string;
  snapshotJson?: Record<string, unknown>;
}

export interface DecidrirDto {
  decisao: 'APROVADO' | 'REPROVADO';
  observacao?: string;
}

export interface DelegarDto {
  novoAprovadorId: number;
  observacao?: string;
}

export interface ContagemPendentes {
  total: number;
  porModulo?: Record<AprovacaoModulo, number>;
}

export const aprovacoesService = {
  // Instâncias
  listar: (params?: Record<string, unknown>) =>
    api.get('/aprovacoes', { params }).then(r => r.data.data),

  pendentesParaMim: () =>
    api.get('/aprovacoes/pendentes-para-mim').then(r => r.data.data),

  contagemPendentes: (): Promise<ContagemPendentes> =>
    api.get('/aprovacoes/contagem-pendentes').then(r => r.data.data),

  buscar: (id: number): Promise<AprovacaoInstancia> =>
    api.get(`/aprovacoes/${id}`).then(r => r.data.data),

  solicitar: (dto: SolicitarAprovacaoDto): Promise<AprovacaoInstancia> =>
    api.post('/aprovacoes', dto).then(r => r.data.data),

  decidir: (id: number, dto: DecidrirDto): Promise<AprovacaoInstancia> =>
    api.patch(`/aprovacoes/${id}/decidir`, dto).then(r => r.data.data),

  cancelar: (id: number, motivo?: string): Promise<AprovacaoInstancia> =>
    api.patch(`/aprovacoes/${id}/cancelar`, { motivo }).then(r => r.data.data),

  delegar: (id: number, dto: DelegarDto): Promise<AprovacaoInstancia> =>
    api.patch(`/aprovacoes/${id}/delegar`, dto).then(r => r.data.data),

  reabrir: (id: number): Promise<AprovacaoInstancia> =>
    api.patch(`/aprovacoes/${id}/reabrir`).then(r => r.data.data),

  // Templates
  listarTemplates: (params?: Record<string, unknown>): Promise<WorkflowTemplate[]> =>
    api.get('/aprovacoes/templates', { params }).then(r => r.data.data),

  buscarTemplate: (id: number): Promise<WorkflowTemplate> =>
    api.get(`/aprovacoes/templates/${id}`).then(r => r.data.data),

  criarTemplate: (dto: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> =>
    api.post('/aprovacoes/templates', dto).then(r => r.data.data),

  atualizarTemplate: (id: number, dto: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> =>
    api.put(`/aprovacoes/templates/${id}`, dto).then(r => r.data.data),

  desativarTemplate: (id: number): Promise<WorkflowTemplate> =>
    api.patch(`/aprovacoes/templates/${id}/desativar`).then(r => r.data.data),
};
