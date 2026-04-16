// frontend-web/src/services/concretagem.service.ts
// Serviço de Concretagem — Croqui (SPEC 7) + Concretagens/Caminhões/CPs/Dashboard (Sprint 8)
import { api } from './api';

// ─── Tipos Croqui ─────────────────────────────────────────────────────────────

export type TipoElemento = 'painel_laje' | 'pilar' | 'viga' | 'outro';

export interface ElementoCroqui {
  id: string;
  tipo: TipoElemento;
  label: string;
  col: number;
  row: number;
  colspan: number;
  rowspan: number;
}

export interface ElementosPayload {
  eixos_x: string[];
  eixos_y: string[];
  elementos: ElementoCroqui[];
}

export interface CroquiResumo {
  id: number;
  nome: string;
  obra_local_id: number | null;
  ia_confianca: number | null;
  created_at: string;
}

export interface CroquiDetalhe extends CroquiResumo {
  obra_id: number;
  elementos: ElementosPayload;
  criado_por: number;
  updated_at: string;
}

export interface AnalisarPlantaPayload {
  arquivo_base64: string;
  mime_type: 'image/jpeg' | 'image/png' | 'application/pdf';
  contexto?: string;
}

export interface AnalisarPlantaResult {
  eixos_x: string[];
  eixos_y: string[];
  elementos: ElementoCroqui[];
  confianca: number;
  observacoes: string | null;
  tokens_in: number;
  tokens_out: number;
}

export interface CreateCroquiPayload {
  nome: string;
  obra_local_id?: number;
  elementos: ElementosPayload;
  ia_confianca?: number;
}

export type UpdateCroquiPayload = Partial<Omit<CreateCroquiPayload, 'ia_confianca'>>;

// ─── Tipos Concretagens ───────────────────────────────────────────────────────

export type StatusConcretagem = 'PROGRAMADA' | 'EM_LANCAMENTO' | 'EM_RASTREABILIDADE' | 'CONCLUIDA' | 'CANCELADA';
// Alias para compatibilidade com código legado
export type StatusBetonada = StatusConcretagem;

export type StatusCaminhao = 'CHEGOU' | 'EM_LANCAMENTO' | 'CONCLUIDO' | 'REJEITADO';
export type StatusCp = 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';

export interface Concretagem {
  id: number;
  numero: string;
  elemento_estrutural: string;
  obra_local_id: number | null;
  volume_previsto: string;
  fck_especificado: number;
  fornecedor_id: number | null;
  data_programada: string;
  status: StatusConcretagem;
  responsavel_id: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  cp_total: number;
  cp_rompidos: number;
  proxima_ruptura_data: string | null;
  caminhao_total: number;
}

// Alias para compatibilidade com código legado
export type BetonadaResumo = ConcrtagemResumo;

export interface ConcrtagemResumo {
  id: number;
  numero: string;
  elemento_estrutural: string;
  obra_local_id: number | null;
  volume_previsto: number;
  fck_especificado: number;
  fornecedor_id: number;
  data_programada: string;
  status: StatusConcretagem;
  responsavel_id: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  bombeado: boolean;
  liberado_carregamento: boolean;
  intervalo_min_caminhoes: number | null;
}

export interface CaminhaoConcreto {
  id: number;
  sequencia: number;
  numero_nf: string;
  data_emissao_nf: string;
  volume: number;
  motorista: string | null;
  placa: string | null;
  hora_chegada: string | null;
  hora_inicio_lancamento: string | null;
  hora_fim_lancamento: string | null;
  elemento_lancado: string | null;
  slump_especificado: number | null;
  slump_medido: number | null;
  temperatura: number | null;
  status: StatusCaminhao;
  nf_vencida: boolean;
  created_at: string;
  nao_descarregou: boolean;
  responsabilidade_concreteira: boolean;
  lacre_aprovado: boolean | null;
  fator_ac: number | null;
  flow: number | null;
  ensaio_j: number | null;
  sobra_tipo: string | null;
  sobra_volume: number | null;
  foto_nf_url: string | null;
}

export interface CorpoDeProva {
  id: number;
  caminhao_id: number;
  numero: string;
  idade_dias: number;
  data_moldagem: string;
  data_ruptura_prev: string;
  data_ruptura_real: string | null;
  resistencia: number | null;
  status: StatusCp;
  alerta_enviado: boolean;
  created_at: string;
}

export interface ConcrtagemDetalhe extends ConcrtagemResumo {
  obra_id: number;
  traco_especificado: string | null;
  cancelamento_solicitante: string | null;
  cancelamento_multa: boolean;
  caminhoes: CaminhaoConcreto[];
  corpos_de_prova: CorpoDeProva[];
}

// Alias para compatibilidade com código legado
export type BetonadaDetalhe = ConcrtagemDetalhe;

export interface ListConcrtagensParams {
  status?: StatusConcretagem;
  search?: string;
  page?: number;
  limit?: number;
}

// Alias para compatibilidade com código legado
export type ListBetonadasParams = ListConcrtagensParams;

export interface ListConcrtagensResult {
  items: Concretagem[];
  total: number;
  page: number;
  limit: number;
}

// Alias para compatibilidade com código legado
export type ListBetonadasResult = ListConcrtagensResult;

export interface CreateConcrtagemPayload {
  elemento_estrutural: string;
  obra_local_id?: number;
  volume_previsto: number;
  traco_especificado?: string;
  fck_especificado: number;
  fornecedor_id: number;
  data_programada: string;
  hora_programada?: string;
  responsavel_id?: number;
  observacoes?: string;
  bombeado?: boolean;
  intervalo_min_caminhoes?: number;
}

// Alias para compatibilidade com código legado
export type CreateBetonadaPayload = CreateConcrtagemPayload;

export type UpdateConcrtagemPayload = Partial<CreateConcrtagemPayload & { status: StatusConcretagem }>;

// Alias para compatibilidade com código legado
export type UpdateBetonadaPayload = UpdateConcrtagemPayload;

export interface CreateCaminhaoPayload {
  numero_nf: string;
  data_emissao_nf: string;
  volume: number;
  motorista?: string;
  placa?: string;
  hora_carregamento?: string;
  numero_bt?: string;
  lancamento_parcial?: boolean;
  elementos_lancados?: string[];
  hora_chegada?: string;
  elemento_lancado?: string;
  slump_especificado?: number;
  slump_medido?: number;
  temperatura?: number;
  incidentes?: string;
  nao_descarregou?: boolean;
  lacre_aprovado?: boolean;
  fator_ac?: number;
  flow?: number;
  ensaio_j?: number;
  sobra_tipo?: string;
  sobra_volume?: number;
  foto_nf_url?: string;
}

export interface RegistrarSlumpPayload {
  slump_medido: number;
  temperatura?: number;
  incidentes?: string;
}

export interface CreateCpPayload {
  caminhao_id: number;
  idade_dias?: number; // omit → cria 3, 7, 28 dias
  data_moldagem: string;
  laboratorio_id?: number;
  observacoes?: string;
}

export interface RegistrarRupturaPayload {
  resistencia: number;
  data_ruptura_real?: string;
  observacoes?: string;
}

export interface CancelConcrtagemPayload {
  solicitante?: 'OBRA' | 'CONCRETEIRA';
  multa?: boolean;
}

// Alias para compatibilidade com código legado
export type CancelBetonadaPayload = CancelConcrtagemPayload;

export interface PatchCaminhaoPayload {
  fator_ac?: number;
  flow?: number;
  ensaio_j?: number;
  sobra_tipo?: 'APROVEITADO' | 'DESCARTADO' | 'NAO_PAGAR';
  sobra_volume?: number;
  foto_nf_url?: string;
}

export interface OcrNfPayload {
  image_base64: string;
  media_type: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface OcrNfResult {
  numero_nf: string | null;
  data_emissao_nf: string | null;
  volume: number | null;
  motorista: string | null;
  placa: string | null;
  fornecedor_nome: string | null;
  fck: number | null;
  traco: string | null;
  confianca: number;
  raw_text: string;
}

export interface CreateLaudoPayload {
  betonada_id: number;
  numero: string;
  tipo?: 'CONCRETO' | 'ACO' | 'SOLO' | 'ARGAMASSA' | 'OUTRO';
  data_emissao: string;
  laboratorio_nome?: string;
  arquivo_url?: string;
  resultado?: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
  observacoes?: string;
}

export interface Laudo {
  id: number;
  betonada_id: number;
  numero: string;
  tipo: string;
  data_emissao: string;
  laboratorio_nome: string | null;
  resultado: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
  observacoes: string | null;
  aprovado_por: number | null;
  aprovado_em: string | null;
  criado_por: number;
  created_at: string;
}

export interface CreateRacPayload {
  obra_id: number;
  nc_id?: number;
  titulo: string;
  descricao_problema: string;
  causa_raiz?: string;
  acao_corretiva?: string;
  acao_preventiva?: string;
  responsavel_id?: number;
  prazo?: string;
}

export interface Rac {
  id: number;
  obra_id: number;
  nc_id: number | null;
  numero: string;
  titulo: string;
  descricao_problema: string;
  causa_raiz: string | null;
  acao_corretiva: string | null;
  acao_preventiva: string | null;
  responsavel_id: number | null;
  prazo: string | null;
  status: 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
  eficacia_verificada: boolean;
  criado_por: number;
  created_at: string;
}

// ─── Tipos Dashboard ──────────────────────────────────────────────────────────

export interface ConcreteiraRank {
  fornecedor_id: number;
  total_caminhoes: number;
  volume_total: number;
  slump_medio: number | null;
  taxa_aprovacao_cps: number;
}

export interface DashboardConcretagemKpis {
  volume_previsto_total: number;
  volume_realizado_total: number;
  betonadas_total: number;
  betonadas_concluidas: number;
  taxa_aprovacao_cps: number;
  total_cps: number;
  cps_aprovados: number;
  cps_reprovados: number;
  cps_aguardando: number;
  cps_vencidos_sem_resultado: number;
  resistencia_media_28d: number;
  ncs_abertas: number;
  ranking_concreteiras: ConcreteiraRank[];
}

export interface DashboardFinanceiro {
  cancelamentos_com_multa: number;
  total_cancelamentos: number;
  volume_contestado_m3: number;
  volume_descartado_m3: number;
  volume_aproveitado_m3: number;
  caminhoes_nao_descarregaram: number;
  por_traco: {
    traco: string;
    total_betonadas: number;
    volume_previsto: number;
    volume_realizado: number;
    resistencia_media_28d: number | null;
    taxa_aprovacao_cps: number;
  }[];
  ranking_avancado: {
    fornecedor_id: number;
    fornecedor_nome: string;
    total_caminhoes: number;
    volume_total: number;
    caminhoes_nao_descarregaram: number;
    volume_contestado: number;
    fator_ac_medio: number | null;
    flow_medio: number | null;
    taxa_aprovacao_cps: number;
    slump_medio: number | null;
  }[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

const CROQUI_BASE = (obraId: number) => `/obras/${obraId}/croquis`;
const CONCRETAGENS_BASE = (obraId: number) => `/obras/${obraId}/concretagem/concretagens`;
const CONC_BASE = '/concretagem';

export const concretagemService = {
  // ── Croqui (SPEC 7) ─────────────────────────────────────────────────────────

  analisarPlanta: (obraId: number, payload: AnalisarPlantaPayload) =>
    api
      .post<{ status: string; data: AnalisarPlantaResult }>(
        `${CROQUI_BASE(obraId)}/analisar`,
        payload,
      )
      .then((r) => r.data.data),

  listarCroquis: (obraId: number) =>
    api
      .get<{ status: string; data: CroquiResumo[] }>(CROQUI_BASE(obraId))
      .then((r) => r.data.data),

  buscarCroqui: (obraId: number, croquiId: number) =>
    api
      .get<{ status: string; data: CroquiDetalhe }>(`${CROQUI_BASE(obraId)}/${croquiId}`)
      .then((r) => r.data.data),

  criarCroqui: (obraId: number, payload: CreateCroquiPayload) =>
    api
      .post<{ status: string; data: CroquiDetalhe }>(CROQUI_BASE(obraId), payload)
      .then((r) => r.data.data),

  atualizarCroqui: (obraId: number, croquiId: number, payload: UpdateCroquiPayload) =>
    api
      .patch<{ status: string; data: CroquiDetalhe }>(
        `${CROQUI_BASE(obraId)}/${croquiId}`,
        payload,
      )
      .then((r) => r.data.data),

  deletarCroqui: (obraId: number, croquiId: number) =>
    api
      .delete<{ status: string; data: { id: number } }>(
        `${CROQUI_BASE(obraId)}/${croquiId}`,
      )
      .then((r) => r.data.data),

  // Aliases para compatibilidade com código existente
  listar: (obraId: number) => concretagemService.listarCroquis(obraId),
  buscar: (obraId: number, croquiId: number) => concretagemService.buscarCroqui(obraId, croquiId),
  criar: (obraId: number, payload: CreateCroquiPayload) => concretagemService.criarCroqui(obraId, payload),
  atualizar: (obraId: number, croquiId: number, payload: UpdateCroquiPayload) =>
    concretagemService.atualizarCroqui(obraId, croquiId, payload),
  deletar: (obraId: number, croquiId: number) => concretagemService.deletarCroqui(obraId, croquiId),

  // ── Concretagens ─────────────────────────────────────────────────────────────

  listarConcretagens: (obraId: number, params?: ListConcrtagensParams) =>
    api
      .get<{ status: string; data: ListConcrtagensResult }>(CONCRETAGENS_BASE(obraId), { params })
      .then((r) => r.data.data),

  buscarConcretagem: (obraId: number, id: number) =>
    api
      .get<{ status: string; data: ConcrtagemDetalhe }>(`${CONCRETAGENS_BASE(obraId)}/${id}`)
      .then((r) => r.data.data),

  criarConcretagem: (obraId: number, payload: CreateConcrtagemPayload) =>
    api
      .post<{ status: string; data: ConcrtagemDetalhe }>(CONCRETAGENS_BASE(obraId), payload)
      .then((r) => r.data.data),

  atualizarConcretagem: (obraId: number, id: number, payload: UpdateConcrtagemPayload) =>
    api
      .patch<{ status: string; data: ConcrtagemDetalhe }>(`${CONCRETAGENS_BASE(obraId)}/${id}`, payload)
      .then((r) => r.data.data),

  cancelarConcretagem: (obraId: number, id: number) =>
    api
      .delete<{ status: string; data: { id: number } }>(`${CONCRETAGENS_BASE(obraId)}/${id}`)
      .then((r) => r.data.data),

  cancelarConcrtagemComMotivo: (obraId: number, id: number, payload?: CancelConcrtagemPayload) =>
    api
      .delete<{ status: string; data: { id: number } }>(`${CONCRETAGENS_BASE(obraId)}/${id}`, { data: payload })
      .then((r) => r.data.data),

  toggleLiberadoCarregamento: (obraId: number, id: number) =>
    api
      .post<{ status: string; data: { liberado_carregamento: boolean } }>(
        `${CONCRETAGENS_BASE(obraId)}/${id}/toggle-liberado`,
        {},
      )
      .then((r) => r.data.data),

  // Aliases para compatibilidade com código legado
  listarBetonadas: (obraId: number, params?: ListConcrtagensParams) =>
    concretagemService.listarConcretagens(obraId, params),
  buscarBetonada: (obraId: number, id: number) =>
    concretagemService.buscarConcretagem(obraId, id),
  criarBetonada: (obraId: number, payload: CreateConcrtagemPayload) =>
    concretagemService.criarConcretagem(obraId, payload),
  atualizarBetonada: (obraId: number, id: number, payload: UpdateConcrtagemPayload) =>
    concretagemService.atualizarConcretagem(obraId, id, payload),
  cancelarBetonada: (obraId: number, id: number) =>
    concretagemService.cancelarConcretagem(obraId, id),
  cancelarBetonadaComMotivo: (obraId: number, id: number, payload?: CancelConcrtagemPayload) =>
    concretagemService.cancelarConcrtagemComMotivo(obraId, id, payload),

  // ── Caminhões ────────────────────────────────────────────────────────────────

  registrarCaminhao: (concrtagemId: number, payload: CreateCaminhaoPayload) =>
    api
      .post<{ status: string; data: CaminhaoConcreto }>(
        `${CONC_BASE}/concretagens/${concrtagemId}/caminhoes`,
        payload,
      )
      .then((r) => r.data.data),

  registrarSlump: (caminhaoId: number, payload: RegistrarSlumpPayload) =>
    api
      .patch<{ status: string; data: CaminhaoConcreto }>(
        `${CONC_BASE}/caminhoes/${caminhaoId}/slump`,
        payload,
      )
      .then((r) => r.data.data),

  concluirCaminhao: (caminhaoId: number) =>
    api
      .patch<{ status: string; data: CaminhaoConcreto }>(
        `${CONC_BASE}/caminhoes/${caminhaoId}/concluir`,
        {},
      )
      .then((r) => r.data.data),

  rejeitarCaminhao: (caminhaoId: number, motivo: string) =>
    api
      .patch<{ status: string; data: CaminhaoConcreto }>(
        `${CONC_BASE}/caminhoes/${caminhaoId}/rejeitar`,
        { motivo },
      )
      .then((r) => r.data.data),

  patchCaminhao: (caminhaoId: number, payload: PatchCaminhaoPayload) =>
    api
      .patch<{ status: string; data: CaminhaoConcreto }>(
        `${CONC_BASE}/caminhoes/${caminhaoId}`,
        payload,
      )
      .then((r) => r.data.data),

  toggleNaoDescarregou: (caminhaoId: number, responsabilidadeConcreteira?: boolean) =>
    api
      .post<{ status: string; data: { nao_descarregou: boolean } }>(
        `${CONC_BASE}/caminhoes/${caminhaoId}/toggle-nao-descarregou`,
        { responsabilidade_concreteira: responsabilidadeConcreteira },
      )
      .then((r) => r.data.data),

  setLacre: (caminhaoId: number, aprovado: boolean) =>
    api
      .post<{ status: string; data: CaminhaoConcreto }>(
        `${CONC_BASE}/caminhoes/${caminhaoId}/lacre`,
        { aprovado },
      )
      .then((r) => r.data.data),

  ocrNf: (payload: OcrNfPayload) =>
    api
      .post<{ status: string; data: OcrNfResult }>(
        `${CONC_BASE}/caminhoes/ocr-nf`,
        payload,
      )
      .then((r) => r.data.data),

  // ── Corpos de Prova ──────────────────────────────────────────────────────────

  moldagemCp: (concrtagemId: number, payload: CreateCpPayload) =>
    api
      .post<{ status: string; data: CorpoDeProva[] }>(
        `${CONC_BASE}/concretagens/${concrtagemId}/cps`,
        payload,
      )
      .then((r) => r.data.data),

  registrarRuptura: (cpId: number, payload: RegistrarRupturaPayload) =>
    api
      .patch<{ status: string; data: CorpoDeProva }>(
        `${CONC_BASE}/cps/${cpId}/ruptura`,
        payload,
      )
      .then((r) => r.data.data),

  listarCps: (concrtagemId: number) =>
    api
      .get<{ status: string; data: CorpoDeProva[] }>(
        `${CONC_BASE}/concretagens/${concrtagemId}/cps`,
      )
      .then((r) => r.data.data),

  // ── Laudos ──────────────────────────────────────────────────────────────────

  criarLaudo: (payload: CreateLaudoPayload) =>
    api
      .post<{ status: string; data: Laudo }>('/concretagem/laudos', payload)
      .then((r) => r.data.data),

  listarLaudosPorConcretagem: (concrtagemId: number) =>
    api
      .get<{ status: string; data: Laudo[] }>(`/concretagem/laudos/concretagem/${concrtagemId}`)
      .then((r) => r.data.data),

  // Alias para compatibilidade com código legado
  listarLaudosPorBetonada: (concrtagemId: number) =>
    concretagemService.listarLaudosPorConcretagem(concrtagemId),

  aprovarLaudo: (id: number) =>
    api
      .post<{ status: string; data: Laudo }>(`/concretagem/laudos/${id}/aprovar`, {})
      .then((r) => r.data.data),

  reprovarLaudo: (id: number) =>
    api
      .post<{ status: string; data: Laudo }>(`/concretagem/laudos/${id}/reprovar`, {})
      .then((r) => r.data.data),

  // ── RACs ─────────────────────────────────────────────────────────────────────

  criarRac: (obraId: number, payload: CreateRacPayload) =>
    api
      .post<{ status: string; data: Rac }>(`/obras/${obraId}/concretagem/racs`, payload)
      .then((r) => r.data.data),

  listarRacs: (obraId: number, status?: string) =>
    api
      .get<{ status: string; data: Rac[] }>(`/obras/${obraId}/concretagem/racs`, { params: status ? { status } : undefined })
      .then((r) => r.data.data),

  verificarEficaciaRac: (obraId: number, id: number) =>
    api
      .post<{ status: string; data: Rac }>(`/obras/${obraId}/concretagem/racs/${id}/verificar-eficacia`, {})
      .then((r) => r.data.data),

  // ── Dashboard ────────────────────────────────────────────────────────────────

  getDashboard: (obraId: number) =>
    api
      .get<{ status: string; data: DashboardConcretagemKpis }>(
        `/obras/${obraId}/concretagem/dashboard`,
      )
      .then((r) => r.data.data),

  getFinanceiro: (obraId: number): Promise<DashboardFinanceiro> =>
    api
      .get<{ status: string; data: DashboardFinanceiro }>(
        `/obras/${obraId}/concretagem/financeiro`,
      )
      .then((r) => r.data.data),
};
