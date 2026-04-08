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
export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida';
export type StatusRegistro = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao';
export type StatusGrade = 'nao_avaliado' | 'aprovado' | 'nc' | 'pendente';

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
  item_criticidade?: string;
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
