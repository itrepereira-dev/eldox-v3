// frontend-web/src/services/concretagem.service.ts
// Serviço de Concretagem — Croqui (SPEC 7) + Betonadas/Caminhões/CPs/Dashboard (Sprint 8)
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

// ─── Tipos Betonadas ──────────────────────────────────────────────────────────

export type StatusBetonada = 'PROGRAMADA' | 'EM_LANCAMENTO' | 'CONCLUIDA' | 'CANCELADA';
export type StatusCaminhao = 'CHEGOU' | 'EM_LANCAMENTO' | 'CONCLUIDO' | 'REJEITADO';
export type StatusCp = 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';

export interface BetonadaResumo {
  id: number;
  numero: string;
  elemento_estrutural: string;
  obra_local_id: number | null;
  volume_previsto: number;
  fck_especificado: number;
  fornecedor_id: number;
  data_programada: string;
  status: StatusBetonada;
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

export interface BetonadaDetalhe extends BetonadaResumo {
  obra_id: number;
  traco_especificado: string | null;
  cancelamento_solicitante: string | null;
  cancelamento_multa: boolean;
  caminhoes: CaminhaoConcreto[];
  corpos_de_prova: CorpoDeProva[];
}

export interface ListBetonadasParams {
  status?: StatusBetonada;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListBetonadasResult {
  items: BetonadaResumo[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateBetonadaPayload {
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

export type UpdateBetonadaPayload = Partial<CreateBetonadaPayload & { status: StatusBetonada }>;

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

export interface CancelBetonadaPayload {
  solicitante?: 'OBRA' | 'CONCRETEIRA';
  multa?: boolean;
}

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
const BETONADAS_BASE = (obraId: number) => `/obras/${obraId}/concretagem/betonadas`;
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

  // ── Betonadas ────────────────────────────────────────────────────────────────

  listarBetonadas: (obraId: number, params?: ListBetonadasParams) =>
    api
      .get<{ status: string; data: ListBetonadasResult }>(BETONADAS_BASE(obraId), { params })
      .then((r) => r.data.data),

  buscarBetonada: (obraId: number, id: number) =>
    api
      .get<{ status: string; data: BetonadaDetalhe }>(`${BETONADAS_BASE(obraId)}/${id}`)
      .then((r) => r.data.data),

  criarBetonada: (obraId: number, payload: CreateBetonadaPayload) =>
    api
      .post<{ status: string; data: BetonadaDetalhe }>(BETONADAS_BASE(obraId), payload)
      .then((r) => r.data.data),

  atualizarBetonada: (obraId: number, id: number, payload: UpdateBetonadaPayload) =>
    api
      .patch<{ status: string; data: BetonadaDetalhe }>(`${BETONADAS_BASE(obraId)}/${id}`, payload)
      .then((r) => r.data.data),

  cancelarBetonada: (obraId: number, id: number) =>
    api
      .delete<{ status: string; data: { id: number } }>(`${BETONADAS_BASE(obraId)}/${id}`)
      .then((r) => r.data.data),

  cancelarBetonadaComMotivo: (obraId: number, id: number, payload?: CancelBetonadaPayload) =>
    api
      .delete<{ status: string; data: { id: number } }>(`${BETONADAS_BASE(obraId)}/${id}`, { data: payload })
      .then((r) => r.data.data),

  toggleLiberadoCarregamento: (obraId: number, id: number) =>
    api
      .post<{ status: string; data: { liberado_carregamento: boolean } }>(
        `${BETONADAS_BASE(obraId)}/${id}/toggle-liberado`,
        {},
      )
      .then((r) => r.data.data),

  // ── Caminhões ────────────────────────────────────────────────────────────────

  registrarCaminhao: (betonadaId: number, payload: CreateCaminhaoPayload) =>
    api
      .post<{ status: string; data: CaminhaoConcreto }>(
        `${CONC_BASE}/betonadas/${betonadaId}/caminhoes`,
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

  moldagemCp: (betonadaId: number, payload: CreateCpPayload) =>
    api
      .post<{ status: string; data: CorpoDeProva[] }>(
        `${CONC_BASE}/betonadas/${betonadaId}/cps`,
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

  listarCps: (betonadaId: number) =>
    api
      .get<{ status: string; data: CorpoDeProva[] }>(
        `${CONC_BASE}/betonadas/${betonadaId}/cps`,
      )
      .then((r) => r.data.data),

  // ── Laudos ──────────────────────────────────────────────────────────────────

  criarLaudo: (payload: CreateLaudoPayload) =>
    api
      .post<{ status: string; data: Laudo }>('/concretagem/laudos', payload)
      .then((r) => r.data.data),

  listarLaudosPorBetonada: (betonadaId: number) =>
    api
      .get<{ status: string; data: Laudo[] }>(`/concretagem/laudos/betonada/${betonadaId}`)
      .then((r) => r.data.data),

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
