export type Criticidade = 'critico' | 'maior' | 'menor';
export type FotoModo = 'nenhuma' | 'opcional' | 'obrigatoria';

export interface FvsCategoria {
  id: number;
  tenant_id: number;
  nome: string;
  ordem: number;
  ativo: boolean;
  created_at: Date;
  is_sistema: boolean; // computed: tenant_id === 0
}

export interface FvsServico {
  id: number;
  tenant_id: number;
  categoria_id: number | null;
  codigo: string | null;
  nome: string;
  norma_referencia: string | null;
  ordem: number;
  ativo: boolean;
  created_at: Date;
  deleted_at: Date | null;
  is_sistema: boolean; // computed: tenant_id === 0
  itens?: FvsItem[];
}

export interface FvsItem {
  id: number;
  tenant_id: number;
  servico_id: number;
  descricao: string;
  criterio_aceite: string | null;
  tolerancia: string | null;
  metodo_verificacao: string | null;
  criticidade: Criticidade;
  foto_modo: FotoModo;
  foto_minimo: number;
  foto_maximo: number;
  ordem: number;
  ativo: boolean;
  created_at: Date;
}

// ─── Sprint 2: Inspeção ──────────────────────────────────────────────────────

export type RegimeFicha = 'pbqph' | 'norma_tecnica' | 'livre';
export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida' | 'aguardando_parecer' | 'aprovada';
export type StatusRegistro =
  | 'nao_avaliado'
  | 'conforme'
  | 'nao_conforme'
  | 'excecao'
  | 'conforme_apos_reinspecao'
  | 'nc_apos_reinspecao'
  | 'liberado_com_concessao'
  | 'retrabalho';

export type StatusGrade =
  | 'nao_avaliado'
  | 'parcial'
  | 'aprovado'
  | 'nc'
  | 'nc_final'
  | 'liberado'
  | 'pendente';

export interface FichaFvs {
  id: number;
  tenant_id: number;
  obra_id: number;
  nome: string;
  regime: RegimeFicha;
  status: StatusFicha;
  criado_por: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  // Sprint 4a
  modelo_id: number | null;
  exige_ro: boolean;
  exige_reinspecao: boolean;
  exige_parecer?: boolean;
}

export interface FichaFvsComProgresso extends FichaFvs {
  progresso: number; // 0-100, percentual de itens avaliados (não nao_avaliado)
}

export interface FichaServico {
  id: number;
  tenant_id: number;
  ficha_id: number;
  servico_id: number;
  itens_excluidos: number[] | null;
  ordem: number;
  // joined
  servico_nome?: string;
  locais?: FichaServicoLocal[];
}

export interface FichaServicoLocal {
  id: number;
  tenant_id: number;
  ficha_servico_id: number;
  obra_local_id: number;
  equipe_responsavel: string | null;
  // joined
  local_nome?: string;
}

export interface FvsRegistro {
  id: number;
  tenant_id: number;
  ficha_id: number;
  servico_id: number;
  item_id: number;
  obra_local_id: number;
  status: StatusRegistro;
  observacao: string | null;
  inspecionado_por: number | null;
  inspecionado_em: Date | null;
  created_at: Date;
  updated_at: Date;
  // joined (na listagem de registros por local)
  item_descricao?: string;
  item_criticidade?: Criticidade;
  item_criterio_aceite?: string | null;
  evidencias_count?: number;
  equipe_responsavel?: string | null;
}

export interface FvsGrade {
  servicos: { id: number; nome: string }[];
  locais: { id: number; nome: string; pavimento_id: number | null }[];
  celulas: Record<number, Record<number, StatusGrade>>; // celulas[servicoId][obraLocalId]
}

export interface FvsEvidencia {
  id: number;
  tenant_id: number;
  registro_id: number;
  ged_versao_id: number;
  created_at: Date;
  // joined
  url?: string;
  nome_original?: string;
}

export interface FichaDetalhada extends FichaFvs {
  servicos: (FichaServico & { locais: FichaServicoLocal[] })[];
  progresso: number;
}

export interface FvsAuditLog {
  id: number;
  tenant_id: number;
  ficha_id: number;
  registro_id: number | null;
  acao: string;
  status_de: string | null;
  status_para: string | null;
  usuario_id: number;
  ip_origem: string | null;
  detalhes: Record<string, unknown> | null;
  criado_em: Date;
}

// ─── Sprint 3: RO, Reinspeção e Parecer ─────────────────────────────────────

export type StatusRo = 'aberto' | 'concluido';
export type StatusServicoNc = 'pendente' | 'desbloqueado' | 'verificado';
export type DecisaoParecer = 'aprovado' | 'rejeitado';
export type Causa6M = 'mao_obra' | 'material' | 'metodo' | 'gestao' | 'medida' | 'meio_ambiente' | 'maquina';

export interface RoOcorrencia {
  id: number;
  tenant_id: number;
  ficha_id: number;
  ciclo_numero: number;
  numero: string;
  tipo: 'real' | 'potencial';
  responsavel_id: number;
  data_ocorrencia: string; // DATE → string no raw SQL
  o_que_aconteceu: string | null;
  acao_imediata: string | null;
  causa_6m: Causa6M | null;
  justificativa_causa: string | null;
  status: StatusRo;
  created_at: Date;
  updated_at: Date;
  // joined
  servicos?: RoServicoNc[];
}

export interface RoServicoNc {
  id: number;
  tenant_id: number;
  ro_id: number;
  servico_id: number;
  servico_nome: string;
  acao_corretiva: string | null;
  status: StatusServicoNc;
  ciclo_reinspecao: number | null;
  desbloqueado_por: number | null;
  desbloqueado_em: Date | null;
  verificado_em: Date | null;
  created_at: Date;
  // joined
  itens?: RoServicoItemNc[];
  evidencias?: RoServicoEvidencia[];
}

export interface RoServicoItemNc {
  id: number;
  tenant_id: number;
  ro_servico_nc_id: number;
  registro_id: number;
  item_descricao: string;
  item_criticidade: Criticidade;
}

export interface RoServicoEvidencia {
  id: number;
  tenant_id: number;
  ro_servico_nc_id: number;
  versao_ged_id: number;
  descricao: string | null;
  created_at: Date;
  // joined
  url?: string;
  nome_original?: string;
}

export interface FvsParecer {
  id: number;
  tenant_id: number;
  ficha_id: number;
  decisao: DecisaoParecer;
  observacao: string | null;
  itens_referenciados: { registro_id: number; item_descricao: string; servico_nome: string }[] | null;
  criado_por: number;
  created_at: Date;
}

// FvsRegistro com campos de ciclo e desbloqueado (Sprint 3)
export interface FvsRegistroComCiclo extends FvsRegistro {
  ciclo: number;
  desbloqueado: boolean; // item está em ro_servico_itens_nc (reinspecao desbloqueada)
}

// ─── Sprint 4a: Templates de Inspeção ───────────────────────────────────────

export type StatusModelo = 'rascunho' | 'concluido';
export type EscopoModelo = 'empresa' | 'obra';
export type RegimeModelo = 'livre' | 'pbqph';

export interface FvsModelo {
  id: number;
  tenant_id: number;
  nome: string;
  descricao: string | null;
  versao: number;
  escopo: EscopoModelo;
  obra_id: number | null;
  status: StatusModelo;
  bloqueado: boolean;
  regime: RegimeModelo;
  exige_ro: boolean;
  exige_reinspecao: boolean;
  exige_parecer: boolean;
  concluido_por: number | null;
  concluido_em: Date | null;
  criado_por: number;
  deleted_at: Date | null;
  // joined (opcional)
  servicos?: FvsModeloServico[];
  obras_count?: number; // COUNT de obra_modelo_fvs ativo
}

export interface FvsModeloServico {
  id: number;
  tenant_id: number;
  modelo_id: number;
  servico_id: number;
  ordem: number;
  itens_excluidos: number[] | null;
  // joined
  servico_nome?: string;
}

export interface ObraModeloFvs {
  id: number;
  tenant_id: number;
  obra_id: number;
  modelo_id: number;
  vinculado_por: number;
  fichas_count: number;
  created_at: Date;
  deleted_at: Date | null;
  // joined
  modelo_nome?: string;
  obra_nome?: string;
}

// ─── Sprint 4b: NCs Explícitas ───────────────────────────────────────────────

export type StatusNc = 'aberta' | 'em_tratamento' | 'aguardando_reinspecao' | 'encerrada' | 'cancelada';
export type SlaStatus = 'no_prazo' | 'alerta' | 'vencido';

export interface FvsNaoConformidade {
  id: number;
  tenant_id: number;
  ficha_id: number;
  registro_id: number;
  numero: string;
  servico_id: number;
  item_id: number;
  obra_local_id: number;
  criticidade: Criticidade;
  status: StatusNc;
  ciclo_numero: number;
  responsavel_id: number | null;
  prazo_resolucao: string | null;
  acao_corretiva: string | null;
  causa_raiz: string | null;
  sla_prazo_dias: number | null;
  sla_status: SlaStatus;
  encerrada_em: Date | null;
  encerrada_por: number | null;
  resultado_final: string | null;
  criado_em: Date;
  criado_por: number;
  // joined
  servico_nome?: string;
  item_descricao?: string;
  local_nome?: string;
}

export interface FvsNcTratamento {
  id: number;
  tenant_id: number;
  nc_id: number;
  ciclo_numero: number;
  descricao: string;
  acao_corretiva: string | null;
  responsavel_id: number;
  prazo: string | null;
  evidencias: { ged_versao_id: number; descricao?: string }[] | null;
  registrado_por: number;
  criado_em: Date;
}
