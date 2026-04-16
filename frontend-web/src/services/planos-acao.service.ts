// frontend-web/src/services/planos-acao.service.ts
import { api } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaModulo = 'FVS' | 'FVM' | 'NC';
export type PaCondicao = 'TAXA_CONFORMIDADE_ABAIXO' | 'ITEM_CRITICO_NC' | 'NC_ABERTA';
export type PaPrioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type PaCampoTipo = 'texto' | 'numero' | 'data' | 'select' | 'usuario' | 'arquivo';

export interface PaConfigCiclo {
  id: number;
  tenant_id: number;
  modulo: PaModulo;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  etapas?: PaConfigEtapa[];
}

export interface PaConfigEtapa {
  id: number;
  tenant_id: number;
  ciclo_id: number;
  nome: string;
  ordem: number;
  cor: string;
  is_inicial: boolean;
  is_final: boolean;
  prazo_dias: number | null;
  roles_transicao: string[];
  created_at: string;
  campos?: PaConfigCampo[];
}

export interface PaConfigCampo {
  id: number;
  tenant_id: number;
  etapa_id: number;
  nome: string;
  chave: string;
  tipo: PaCampoTipo;
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
  created_at: string;
}

export interface PaConfigGatilho {
  id: number;
  tenant_id: number;
  ciclo_id: number;
  modulo: PaModulo;
  condicao: PaCondicao;
  valor_limiar: number | null;
  criticidade_min: string | null;
  ativo: boolean;
  created_at: string;
}

export interface PlanoAcao {
  id: number;
  tenant_id: number;
  ciclo_id: number;
  etapa_atual_id: number;
  etapa_nome: string;
  etapa_cor: string;
  etapa_is_final: boolean;
  modulo: PaModulo;
  origem_tipo: string | null;
  origem_id: number | null;
  obra_id: number;
  numero: string;
  titulo: string;
  descricao: string | null;
  prioridade: PaPrioridade;
  responsavel_id: number | null;
  prazo: string | null;
  campos_extras: Record<string, unknown>;
  aberto_por: number;
  fechado_em: string | null;
  fechado_por: number | null;
  created_at: string;
  updated_at: string;
  // detail fields
  etapas_ciclo?: PaConfigEtapa[];
  historico?: PaHistoricoEntry[];
  campos_etapa_atual?: PaConfigCampo[];
}

export interface PaHistoricoEntry {
  id: number;
  pa_id: number;
  etapa_de_id: number | null;
  etapa_para_id: number;
  etapa_de_nome: string | null;
  etapa_para_nome: string;
  comentario: string | null;
  campos_extras: Record<string, unknown>;
  criado_por: number;
  created_at: string;
}

export interface PaListResult {
  items: PlanoAcao[];
  total: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────
// Note: `api` already has baseURL=/api/v1, so paths here omit that prefix.

export const planosAcaoService = {
  // Ciclos
  getCiclos: (modulo?: string) =>
    api.get<PaConfigCiclo[]>('/planos-acao/config/ciclos', { params: { modulo } })
      .then((r) => r.data),

  createCiclo: (data: { modulo: PaModulo; nome: string; descricao?: string }) =>
    api.post<PaConfigCiclo>('/planos-acao/config/ciclos', data).then((r) => r.data),

  updateCiclo: (id: number, data: { nome?: string; descricao?: string; ativo?: boolean }) =>
    api.patch<PaConfigCiclo>(`/planos-acao/config/ciclos/${id}`, data).then((r) => r.data),

  deleteCiclo: (id: number) =>
    api.delete(`/planos-acao/config/ciclos/${id}`).then((r) => r.data),

  // Etapas
  getEtapas: (cicloId: number) =>
    api.get<PaConfigEtapa[]>(`/planos-acao/config/ciclos/${cicloId}/etapas`).then((r) => r.data),

  createEtapa: (cicloId: number, data: {
    nome: string; ordem: number; cor?: string;
    isInicial?: boolean; isFinal?: boolean;
    prazoDias?: number; rolesTransicao?: string[];
  }) =>
    api.post<PaConfigEtapa>(`/planos-acao/config/ciclos/${cicloId}/etapas`, data).then((r) => r.data),

  updateEtapa: (id: number, data: {
    nome?: string; ordem?: number; cor?: string;
    isInicial?: boolean; isFinal?: boolean;
    prazoDias?: number | null; rolesTransicao?: string[];
  }) =>
    api.patch<PaConfigEtapa>(`/planos-acao/config/etapas/${id}`, data).then((r) => r.data),

  deleteEtapa: (id: number) =>
    api.delete(`/planos-acao/config/etapas/${id}`).then((r) => r.data),

  // Campos
  createCampo: (etapaId: number, data: {
    nome: string; chave: string; tipo: PaCampoTipo;
    opcoes?: string[]; obrigatorio?: boolean; ordem?: number;
  }) =>
    api.post<PaConfigCampo>(`/planos-acao/config/etapas/${etapaId}/campos`, data).then((r) => r.data),

  updateCampo: (id: number, data: {
    nome?: string; tipo?: PaCampoTipo; opcoes?: string[];
    obrigatorio?: boolean; ordem?: number;
  }) =>
    api.patch<PaConfigCampo>(`/planos-acao/config/campos/${id}`, data).then((r) => r.data),

  deleteCampo: (id: number) =>
    api.delete(`/planos-acao/config/campos/${id}`).then((r) => r.data),

  // Gatilhos
  getGatilhos: (cicloId: number) =>
    api.get<PaConfigGatilho[]>(`/planos-acao/config/ciclos/${cicloId}/gatilhos`).then((r) => r.data),

  createGatilho: (cicloId: number, data: {
    condicao: PaCondicao; valorLimiar?: number; criticidadeMin?: string;
  }) =>
    api.post<PaConfigGatilho>(`/planos-acao/config/ciclos/${cicloId}/gatilhos`, data).then((r) => r.data),

  updateGatilho: (id: number, data: { valorLimiar?: number; criticidadeMin?: string; ativo?: boolean }) =>
    api.patch<PaConfigGatilho>(`/planos-acao/config/gatilhos/${id}`, data).then((r) => r.data),

  deleteGatilho: (id: number) =>
    api.delete(`/planos-acao/config/gatilhos/${id}`).then((r) => r.data),

  // PA CRUD
  listPas: (params: {
    obraId?: number; etapaId?: number; prioridade?: string;
    responsavelId?: number; modulo?: string; page?: number; limit?: number;
  }) =>
    api.get<PaListResult>('/planos-acao', { params }).then((r) => r.data),

  getPa: (id: number) =>
    api.get<PlanoAcao>(`/planos-acao/${id}`).then((r) => r.data),

  createPa: (data: {
    cicloId: number; obraId: number; titulo: string; descricao?: string;
    prioridade?: PaPrioridade; responsavelId?: number; prazo?: string;
    origemTipo?: string; origemId?: number; camposExtras?: Record<string, unknown>;
  }) =>
    api.post<PlanoAcao>('/planos-acao', data).then((r) => r.data),

  updatePa: (id: number, data: {
    titulo?: string; descricao?: string; prioridade?: PaPrioridade;
    responsavelId?: number; prazo?: string; camposExtras?: Record<string, unknown>;
  }) =>
    api.patch<PlanoAcao>(`/planos-acao/${id}`, data).then((r) => r.data),

  transicionarEtapa: (id: number, data: {
    etapaParaId: number; comentario?: string; camposExtras?: Record<string, unknown>;
  }) =>
    api.post<PlanoAcao>(`/planos-acao/${id}/transicao`, data).then((r) => r.data),

  deletePa: (id: number) =>
    api.delete(`/planos-acao/${id}`).then((r) => r.data),
};
