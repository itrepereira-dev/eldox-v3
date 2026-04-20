// frontend-web/src/services/ensaios.service.ts
// Tipos e chamadas de API para o módulo de Ensaios (Sprint 5 + SPEC 2)

import { api } from './api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type MaterialTipo =
  | 'bloco_concreto'
  | 'concreto'
  | 'argamassa'
  | 'aco'
  | 'ceramica'
  | 'outro';

export type FrequenciaUnidade = 'dias' | 'm3' | 'lotes';

export interface EnsaioFrequencia {
  valor: number;
  unidade: FrequenciaUnidade;
}

export interface TipoEnsaio {
  id: number;
  tenant_id: number;
  nome: string;
  unidade: string;
  norma_tecnica: string | null;
  material_tipo: MaterialTipo | null;
  valor_ref_min: number | null;
  valor_ref_max: number | null;
  frequencia_valor: number | null;
  frequencia_unidade: FrequenciaUnidade | null;
  ativo: boolean;
  is_sistema: boolean;
  criado_em: string;
  atualizado_em: string;
}

export type TipoEnsaioPayload = Pick<
  TipoEnsaio,
  | 'nome'
  | 'unidade'
  | 'norma_tecnica'
  | 'material_tipo'
  | 'valor_ref_min'
  | 'valor_ref_max'
  | 'frequencia_valor'
  | 'frequencia_unidade'
>;

export interface ListarTiposParams {
  ativo?: boolean;
  material_tipo?: MaterialTipo | '';
}

// ─── Tipos: Laboratórios e Ensaios Laboratoriais ──────────────────────────────

export interface Laboratorio {
  id: number;
  tenant_id: number;
  nome: string;
  cnpj?: string;
  contato?: string;
  ativo: boolean;
  created_at: string;
}

export interface ResultadoEnsaio {
  id: number;
  ensaio_tipo_id: number;
  valor_obtido: number;
  aprovado_auto: boolean | null;
  observacao?: string;
  // Referência do tipo (join)
  tipo_nome?: string;
  tipo_unidade?: string;
  tipo_valor_ref_min?: number | null;
  tipo_valor_ref_max?: number | null;
  tipo_norma_tecnica?: string | null;
}

export interface EnsaioArquivo {
  id: number;
  nome_original: string;
  content_type: string;
  tamanho_bytes: number;
  created_at: string;
  download_url?: string; // presigned URL, se disponível
}

export interface EnsaioRevisao {
  id: number;
  situacao: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
  prioridade: 'normal' | 'alta';
  revisado_por?: number;
  observacao?: string;
  revisado_em?: string;
  created_at: string;
}

export interface EnsaioLaboratorial {
  id: number;
  tenant_id: number;
  obra_id: number;
  fvm_lote_id: number;
  laboratorio_id: number;
  data_ensaio: string;
  nota_fiscal_ref?: string;
  proximo_ensaio_data?: string | null;
  proximo_ensaio_alertado: boolean;
  observacoes?: string;
  criado_por: number;
  created_at: string;
  // Joins
  laboratorio_nome?: string;
  lote_numero?: string;
  dias_para_proximo_cupom?: number | null;
  revisao?: EnsaioRevisao;
  resultados?: ResultadoEnsaio[];
  arquivo?: EnsaioArquivo;
}

export interface CreateEnsaioPayload {
  fvm_lote_id: number;
  laboratorio_id: number;
  obra_id: number;
  data_ensaio: string;
  nota_fiscal_ref?: string;
  observacoes?: string;
  resultados: Array<{
    ensaio_tipo_id: number;
    valor_obtido: number;
    observacao?: string;
  }>;
  arquivo?: {
    base64: string;
    nome_original: string;
    mime_type: string;
  };
  /** Confiança retornada pela EldoX.IA (0..1) quando laudo veio via extração automática. */
  ia_confianca?: number;
  /** Versão GED usada como especificação técnica do ensaio. Opcional. */
  ged_versao_id_spec?: number;
}

// ─── Tipos: Revisões de Laudos ────────────────────────────────────────────────

export interface RevisaoHistoricoItem {
  id: number;
  situacao_anterior?: string;
  situacao_nova: string;
  tipo_evento: string;
  usuario_id: number;
  observacao?: string;
  created_at: string;
}

export interface EnsaioRevisaoDetalhe extends EnsaioRevisao {
  ensaio_id: number;
  obra_id: number;
  fvm_lote_id: number;
  laboratorio_id: number;
  data_ensaio: string;
  proximo_ensaio_data?: string | null;
  laboratorio_nome?: string;
  lote_numero?: string;
  lote_status?: string;
  material_nome?: string;
  fornecedor_nome?: string;
  resultados?: ResultadoEnsaio[];
  historico?: RevisaoHistoricoItem[];
}

export interface ListarRevisoesParams {
  obra_id: number;
  situacao?: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
  prioridade?: 'normal' | 'alta';
  page?: number;
  limit?: number;
}

export interface RevisarLaudoPayload {
  situacao: 'APROVADO' | 'REPROVADO';
  observacao?: string;
  reabrir?: boolean;
}

export interface ListarEnsaiosParams {
  obra_id: number;
  fvm_lote_id?: number;
  situacao_revisao?: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
  page?: number;
  limit?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ensaiosService = {
  listarTipos: (params?: ListarTiposParams) =>
    api
      .get<{ status: string; data: TipoEnsaio[] }>('/ensaios/tipos', { params })
      .then((r) => r.data.data),

  criarTipo: (payload: TipoEnsaioPayload) =>
    api.post<{ status: string; data: TipoEnsaio }>('/ensaios/tipos', payload).then((r) => r.data.data),

  atualizarTipo: (id: number, payload: Partial<TipoEnsaioPayload>) =>
    api.patch<{ status: string; data: TipoEnsaio }>(`/ensaios/tipos/${id}`, payload).then((r) => r.data.data),

  toggleAtivo: (id: number) =>
    api
      .patch<{ status: string; data: TipoEnsaio }>(`/ensaios/tipos/${id}/toggle-ativo`, {})
      .then((r) => r.data.data),

  deletarTipo: (id: number) =>
    api.delete(`/ensaios/tipos/${id}`).then((r) => r.data),

  seedPadrao: () =>
    api
      .post<{ status: string; data: TipoEnsaio[] }>('/ensaios/tipos/seed', {})
      .then((r) => r.data.data),

  // ── Laboratórios ─────────────────────────────────────────────────────────────

  listarLaboratorios: () =>
    api
      .get<{ status: string; data: Laboratorio[] }>('/ensaios/laboratorios')
      .then((r) => r.data.data),

  criarLaboratorio: (data: Omit<Laboratorio, 'id' | 'tenant_id' | 'created_at'>) =>
    api
      .post<{ status: string; data: Laboratorio }>('/ensaios/laboratorios', data)
      .then((r) => r.data.data),

  toggleLaboratorioAtivo: (id: number) =>
    api
      .patch<{ status: string; data: Laboratorio }>(`/ensaios/laboratorios/${id}/toggle-ativo`, {})
      .then((r) => r.data.data),

  // ── Ensaios Laboratoriais ─────────────────────────────────────────────────────

  listarEnsaios: (params: ListarEnsaiosParams) =>
    api
      .get<{ status: string; data: { data: EnsaioLaboratorial[]; meta: any } }>('/ensaios', { params })
      .then((r) => r.data.data),

  criarEnsaio: (payload: CreateEnsaioPayload) =>
    api
      .post<{ status: string; data: { id: number; proximo_ensaio_data: string | null; revisao_id: number; resultados: ResultadoEnsaio[] } }>(
        '/ensaios',
        payload,
      )
      .then((r) => r.data.data),

  buscarEnsaio: (id: number) =>
    api
      .get<{ status: string; data: EnsaioLaboratorial }>(`/ensaios/${id}`)
      .then((r) => r.data.data),

  // ── Revisões de Laudos ────────────────────────────────────────────────────────

  listarRevisoes: (params: ListarRevisoesParams) =>
    api
      .get<{ status: string; data: { data: EnsaioRevisaoDetalhe[]; total: number; page: number; limit: number } }>(
        '/ensaios/revisoes',
        { params },
      )
      .then((r) => r.data.data),

  buscarRevisao: (id: number) =>
    api
      .get<{ status: string; data: EnsaioRevisaoDetalhe }>(`/ensaios/revisoes/${id}`)
      .then((r) => r.data.data),

  revisarLaudo: (id: number, payload: RevisarLaudoPayload) =>
    api
      .patch<{ status: string; data: { id: number; situacao: string; revisado_em: string } }>(
        `/ensaios/revisoes/${id}`,
        payload,
      )
      .then((r) => r.data.data),

  // ── Dashboard de Conformidade (SPEC 5) ───────────────────────────────────────

  getDashboardMateriais: (obraId: number) =>
    api
      .get<{ status: string; data: DashboardMateriaisKpis }>('/dashboard/materiais', { params: { obra_id: obraId } })
      .then((r) => r.data.data),

  // ── EldoX.IA — extração de laudo (SPEC 6) ───────────────────────────────────

  extrairLaudo: (payload: ExtrairLaudoPayload) =>
    api
      .post<{ status: string; data: ExtrairLaudoResult }>('/ensaios/ia/extrair', payload)
      .then((r) => r.data.data),
};

// ─── Tipos Dashboard ──────────────────────────────────────────────────────────

export interface DashboardMateriaisKpis {
  taxa_conformidade: number;
  total_ensaios_revisados: number;
  laudos_pendentes: number;
  lotes_em_quarentena: number;
  proximos_cupons_7d: number;
  ensaios_vencidos: number;
}

// ─── Tipos EldoX.IA (SPEC 6) ─────────────────────────────────────────────────

export interface TipoDisponivelPayload {
  id: number;
  nome: string;
  unidade: string;
}

export interface ResultadoExtraido {
  tipo_id: number | null;
  tipo_nome_extraido: string;
  valor_obtido: number;
  unidade: string;
}

export interface ExtrairLaudoPayload {
  arquivo_base64: string;
  mime_type: 'application/pdf';
  tipos_disponiveis: TipoDisponivelPayload[];
}

export interface ExtrairLaudoResult {
  data_ensaio: string | null;
  resultados: ResultadoExtraido[];
  observacoes: string | null;
  confianca: number;         // 0.0–1.0
  tokens_in: number;
  tokens_out: number;
}
