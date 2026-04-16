// frontend-web/src/services/rdo.service.ts
import { api } from './api';

// ─── Tipos base ──────────────────────────────────────────────────────────────

export type RdoStatus = 'preenchendo' | 'revisao' | 'aprovado' | 'cancelado';
export type PeriodoDia = 'manha' | 'tarde' | 'noite';
export type CondicaoClima = 'ensolarado' | 'nublado' | 'chuvoso' | 'parcialmente_nublado' | 'tempestade';
export type TipoMaoObra = 'proprio' | 'subcontratado' | 'terceirizado';

// ─── Interfaces de entidade ──────────────────────────────────────────────────

export interface Rdo {
  id: number;
  tenant_id: number;
  obra_id: number;
  data: string; // YYYY-MM-DD
  numero: number;
  status: RdoStatus;
  criado_por: number;
  aprovado_por: number | null;
  aprovado_em: string | null;
  resumo_ia: string | null;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
  obra_nome?: string;
}

export interface RdoClima {
  id: number;
  periodo: PeriodoDia;
  condicao: CondicaoClima;
  praticavel: boolean;
  chuva_mm: number | null;
  aplicado_pelo_usuario: boolean;
  sugerido_por_ia: boolean;
}

export interface RdoMaoObra {
  id: number;
  funcao: string;
  quantidade: number;
  tipo: TipoMaoObra;
  nome_personalizado: string | null;
  hora_entrada: string | null;
  hora_saida: string | null;
}

export interface RdoEquipamento {
  id: number;
  nome: string;
  quantidade: number;
  do_catalogo_id: number | null;
}

export interface RdoAtividade {
  id: number;
  descricao: string;
  progresso_pct: number;
  progresso_pct_anterior: number | null;
  ordem: number;
  hora_inicio: string | null;
  hora_fim: string | null;
}

export interface RdoOcorrencia {
  id: number;
  descricao: string;
  tags: string[] | null;
}

export interface RdoChecklistItem {
  id: number;
  descricao: string;
  marcado: boolean;
  ordem: number;
}

export interface RdoCompleto extends Rdo {
  clima: RdoClima[];
  mao_obra: RdoMaoObra[];
  equipamentos: RdoEquipamento[];
  atividades: RdoAtividade[];
  ocorrencias: RdoOcorrencia[];
  checklist: RdoChecklistItem[];
  fotos: unknown[];
  assinaturas: unknown[];
  log_edicoes: unknown[];
}

export interface RdoListResponse {
  data: Rdo[];
  total: number;
  page: number;
  limit: number;
  status_counts: Record<RdoStatus, number>;
}

export interface RdoInteligencia {
  dias_sem_relatorio: number;
  top_ocorrencias: Array<{ tag: string; total: number }>;
  risco_atraso_pct: number;
  tendencia: 'acelerando' | 'estavel' | 'desacelerando';
  previsao_conclusao_ia: string | null;
}

// ─── DTOs de request ─────────────────────────────────────────────────────────

export interface CreateRdoDto {
  obra_id: number;
  data: string;
  copiar_ultimo?: boolean;
  copiar_campos?: string[];
}

export interface UpdateClimaDto {
  itens: Array<{
    periodo: PeriodoDia;
    condicao: CondicaoClima;
    praticavel: boolean;
    chuva_mm?: number;
    aplicado_pelo_usuario: boolean;
  }>;
}

export interface UpdateMaoObraDto {
  itens: Array<{
    funcao: string;
    quantidade: number;
    tipo: TipoMaoObra;
    nome_personalizado?: string;
    hora_entrada?: string;
    hora_saida?: string;
  }>;
}

export interface UpdateEquipamentosDto {
  itens: Array<{ nome: string; quantidade: number; do_catalogo_id?: number }>;
}

export interface UpdateAtividadesDto {
  itens: Array<{
    descricao: string;
    progresso_pct: number;
    ordem: number;
    hora_inicio?: string;
    hora_fim?: string;
  }>;
}

export interface UpdateOcorrenciasDto {
  itens: Array<{ descricao: string; tags?: string[] }>;
}

export interface UpdateChecklistDto {
  itens: Array<{ descricao: string; marcado: boolean; ordem: number }>;
}

export interface StatusRdoDto {
  status: 'revisao' | 'aprovado';
  assinatura_base64?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const rdoService = {
  criar(dto: CreateRdoDto): Promise<{ rdo_id: number; status: RdoStatus; sugestoes_ia: unknown }> {
    return api.post('/diario/rdos', dto).then(r => r.data);
  },

  listar(params: {
    obra_id: number;
    page?: number;
    limit?: number;
    status?: string;
    data_inicio?: string;
    data_fim?: string;
  }): Promise<RdoListResponse> {
    return api.get('/diario/rdos', { params }).then(r => r.data);
  },

  buscar(id: number): Promise<RdoCompleto> {
    return api.get(`/diario/rdos/${id}`).then(r => r.data);
  },

  atualizar(id: number, dto: Partial<{ observacao_geral: string }>): Promise<Rdo> {
    return api.patch(`/diario/rdos/${id}`, dto).then(r => r.data);
  },

  excluir(id: number): Promise<void> {
    return api.delete(`/diario/rdos/${id}`).then(r => r.data);
  },

  avancarStatus(id: number, dto: StatusRdoDto): Promise<{ rdo_id: number; status: RdoStatus }> {
    return api.patch(`/diario/rdos/${id}/status`, dto).then(r => r.data);
  },

  upsertClima(id: number, dto: UpdateClimaDto): Promise<RdoClima[]> {
    return api.put(`/diario/rdos/${id}/clima`, dto).then(r => r.data);
  },

  substituirMaoObra(id: number, dto: UpdateMaoObraDto): Promise<RdoMaoObra[]> {
    return api.put(`/diario/rdos/${id}/mao-de-obra`, dto).then(r => r.data);
  },

  substituirEquipamentos(id: number, dto: UpdateEquipamentosDto): Promise<RdoEquipamento[]> {
    return api.put(`/diario/rdos/${id}/equipamentos`, dto).then(r => r.data);
  },

  substituirAtividades(id: number, dto: UpdateAtividadesDto): Promise<RdoAtividade[]> {
    return api.put(`/diario/rdos/${id}/atividades`, dto).then(r => r.data);
  },

  substituirOcorrencias(id: number, dto: UpdateOcorrenciasDto): Promise<RdoOcorrencia[]> {
    return api.put(`/diario/rdos/${id}/ocorrencias`, dto).then(r => r.data);
  },

  substituirChecklist(id: number, dto: UpdateChecklistDto): Promise<RdoChecklistItem[]> {
    return api.put(`/diario/rdos/${id}/checklist`, dto).then(r => r.data);
  },

  inteligencia(obraId: number): Promise<RdoInteligencia> {
    return api.get(`/diario/obras/${obraId}/inteligencia`).then(r => r.data);
  },

  // Alias conveniente para o RdoWorkflowPage (sem dto wrapper)
  atualizarStatus(id: number, status: 'revisao' | 'aprovado', assinatura_base64?: string): Promise<{ rdo_id: number; status: RdoStatus }> {
    return api.patch(`/diario/rdos/${id}/status`, { status, assinatura_base64 }).then(r => r.data);
  },

  buscarSugestoes(id: number): Promise<Array<{ id: number; agente: string; campo: string; valor_sugerido: unknown; criado_em: string }>> {
    return api.get(`/diario/rdos/${id}/sugestoes`).then(r => r.data);
  },

  aplicarSugestao(id: number, dto: { agente: string; campo: string; acao: 'aplicado' | 'ignorado' | 'editado'; valor_aplicado?: unknown }): Promise<void> {
    return api.post(`/diario/rdos/${id}/aplicar-sugestao`, dto).then(r => r.data);
  },

  validar(id: number): Promise<{ pode_enviar: boolean; inconsistencias: Array<{ tipo: 'bloqueante' | 'atencao' | 'sugestao'; campo: string; mensagem: string; sugestao_correcao: string }> }> {
    return api.post(`/diario/rdos/${id}/validar`).then(r => r.data);
  },
};
