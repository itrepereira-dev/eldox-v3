// frontend-web/src/services/efetivo.service.ts
import { api } from './api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TurnoEfetivo = 'INTEGRAL' | 'MANHA' | 'TARDE' | 'NOITE';
export type TipoEmpresa  = 'PROPRIA' | 'SUBCONTRATADA';

export interface EmpresaEfetivo {
  id:        number;
  tenant_id: number;
  nome:      string;
  tipo:      TipoEmpresa;
  cnpj:      string | null;
  ativa:     boolean;
  criado_em: string;
}

export interface FuncaoEfetivo {
  id:        number;
  tenant_id: number;
  nome:      string;
  ativa:     boolean;
  criado_em: string;
}

export interface ItemEfetivo {
  id:                  number;
  tenant_id:           number;
  registro_efetivo_id: number;
  empresa_id:          number;
  funcao_id:           number;
  quantidade:          number;
  observacao:          string | null;
  empresa_nome?:       string;
  funcao_nome?:        string;
}

export interface RegistroEfetivo {
  id:              number;
  tenant_id:       number;
  obra_id:         number;
  data:            string;
  turno:           TurnoEfetivo;
  fechado:         boolean;
  fechado_por:     number | null;
  fechado_em:      string | null;
  criado_por:      number;
  criado_em:       string;
  atualizado_em:   string;
  rdo_id:          number | null;
  itens?:          ItemEfetivo[];
  total_homens_dia?: number;
}

export interface ResumoEfetivo {
  total_homens_dia: number;
  por_empresa: { empresa_id: number; nome: string; total_homens_dia: number }[];
  por_funcao:  { funcao_id: number;  nome: string; total_homens_dia: number }[];
}

export interface ListagemEfetivo {
  data:   RegistroEfetivo[];
  meta:   { total: number; page: number; total_pages: number };
  resumo: ResumoEfetivo;
}

export interface SugestaoIA {
  itens: {
    empresa_id:   number;
    empresa_nome: string;
    funcao_id:    number;
    funcao_nome:  string;
    quantidade:   number;
  }[];
  confianca:      number;
  base_registros: number;
  observacao:     string;
}

export interface AlertaEfetivo {
  id:         number;
  tenant_id:  number;
  obra_id:    number | null;
  tipo:       'queda_efetivo' | 'empresa_ausente' | 'obra_parada';
  severidade: 'warn' | 'critical';
  mensagem:   string;
  detalhes:   Record<string, unknown> | null;
  lido:       boolean;
  criado_em:  string;
}

export interface CreateRegistroPayload {
  data:  string;
  turno: TurnoEfetivo;
  itens: { empresaId: number; funcaoId: number; quantidade: number; observacao?: string }[];
}

export interface QueryEfetivoParams {
  mes?:   number;
  ano?:   number;
  turno?: TurnoEfetivo;
  page?:  number;
  limit?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const efetivoService = {

  // ── Registros ──────────────────────────────────────────────────────────────

  async getRegistros(obraId: number, params?: QueryEfetivoParams): Promise<ListagemEfetivo> {
    const { data } = await api.get(`/obras/${obraId}/efetivo`, { params });
    return data;
  },

  async getRegistro(obraId: number, id: number): Promise<RegistroEfetivo & { itens: ItemEfetivo[] }> {
    const { data } = await api.get(`/obras/${obraId}/efetivo/${id}`);
    return data;
  },

  async createRegistro(obraId: number, payload: CreateRegistroPayload): Promise<RegistroEfetivo & { itens: ItemEfetivo[] }> {
    const { data } = await api.post(`/obras/${obraId}/efetivo`, payload);
    return data;
  },

  async patchItem(obraId: number, registroId: number, itemId: number, payload: { quantidade?: number; observacao?: string }): Promise<ItemEfetivo> {
    const { data } = await api.patch(`/obras/${obraId}/efetivo/${registroId}/itens/${itemId}`, payload);
    return data;
  },

  async fecharRegistro(obraId: number, id: number): Promise<RegistroEfetivo> {
    const { data } = await api.post(`/obras/${obraId}/efetivo/${id}/fechar`);
    return data;
  },

  async reabrirRegistro(obraId: number, id: number): Promise<RegistroEfetivo> {
    const { data } = await api.post(`/obras/${obraId}/efetivo/${id}/reabrir`);
    return data;
  },

  // ── Empresas ───────────────────────────────────────────────────────────────

  async getEmpresas(): Promise<EmpresaEfetivo[]> {
    const { data } = await api.get('/efetivo/empresas');
    return data;
  },

  async createEmpresa(payload: { nome: string; tipo?: TipoEmpresa; cnpj?: string }): Promise<EmpresaEfetivo> {
    const { data } = await api.post('/efetivo/empresas', payload);
    return data;
  },

  async updateEmpresa(id: number, payload: { nome?: string; cnpj?: string; ativa?: boolean }): Promise<EmpresaEfetivo> {
    const { data } = await api.patch(`/efetivo/empresas/${id}`, payload);
    return data;
  },

  async deleteEmpresa(id: number): Promise<void> {
    await api.delete(`/efetivo/empresas/${id}`);
  },

  // ── Funções ────────────────────────────────────────────────────────────────

  async getFuncoes(): Promise<FuncaoEfetivo[]> {
    const { data } = await api.get('/efetivo/funcoes');
    return data;
  },

  async createFuncao(payload: { nome: string }): Promise<FuncaoEfetivo> {
    const { data } = await api.post('/efetivo/funcoes', payload);
    return data;
  },

  async updateFuncao(id: number, payload: { nome?: string; ativa?: boolean }): Promise<FuncaoEfetivo> {
    const { data } = await api.patch(`/efetivo/funcoes/${id}`, payload);
    return data;
  },

  async deleteFuncao(id: number): Promise<void> {
    await api.delete(`/efetivo/funcoes/${id}`);
  },

  // ── IA ─────────────────────────────────────────────────────────────────────

  async getSugestaoIA(obraId: number): Promise<SugestaoIA> {
    const { data } = await api.get(`/obras/${obraId}/efetivo/ia/sugestao`);
    return data;
  },

  async getAlertas(): Promise<AlertaEfetivo[]> {
    const { data } = await api.get('/efetivo/alertas');
    return data;
  },

  async marcarAlertaLido(id: number): Promise<void> {
    await api.patch(`/efetivo/alertas/${id}/lido`);
  },
};
