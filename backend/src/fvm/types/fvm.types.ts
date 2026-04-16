// backend/src/fvm/types/fvm.types.ts

export type Criticidade  = 'critico' | 'maior' | 'menor';
export type FotoModo     = 'nenhuma' | 'opcional' | 'obrigatoria';
export type TipoItem     = 'visual' | 'documental' | 'dimensional' | 'ensaio';
export type StatusLote   =
  | 'aguardando_inspecao'
  | 'em_inspecao'
  | 'aprovado'
  | 'aprovado_com_ressalva'
  | 'quarentena'
  | 'reprovado'
  | 'cancelado';
export type StatusRegistro = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'nao_aplicavel';
export type SituacaoFornecedor = 'em_avaliacao' | 'homologado' | 'suspenso' | 'desqualificado';
export type TipoFornecedor = 'fabricante' | 'distribuidor' | 'locadora' | 'prestador';

// ─── Catálogo ────────────────────────────────────────────────────────────────

export interface FvmCategoria {
  id: number;
  tenant_id: number;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ordem: number;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
  is_sistema: boolean; // computed: tenant_id === 0
  total_materiais?: number;
}

export interface FvmMaterial {
  id: number;
  tenant_id: number;
  categoria_id: number | null;
  nome: string;
  codigo: string | null;
  norma_referencia: string | null;
  unidade: string;
  descricao: string | null;
  foto_modo: FotoModo;
  exige_certificado: boolean;
  exige_nota_fiscal: boolean;
  exige_laudo_ensaio: boolean;
  prazo_quarentena_dias: number;
  ordem: number;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  is_sistema: boolean;
  // joined (opcional)
  categoria_nome?: string;
  total_itens?: number;
  total_documentos?: number;
}

export interface FvmItem {
  id: number;
  tenant_id: number;
  material_id: number;
  tipo: TipoItem;
  descricao: string;
  criterio_aceite: string | null;
  criticidade: Criticidade;
  foto_modo: FotoModo;
  ordem: number;
  ativo: boolean;
  created_at: Date;
}

export interface FvmDocumentoExigido {
  id: number;
  tenant_id: number;
  material_id: number;
  nome: string;
  sigla: string | null;
  obrigatorio: boolean;
  descricao: string | null;
  ordem: number;
}

// ─── Fornecedores ────────────────────────────────────────────────────────────

export interface FvmFornecedor {
  id: number;
  tenant_id: number;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  tipo: TipoFornecedor;
  situacao: SituacaoFornecedor;
  email: string | null;
  telefone: string | null;
  responsavel_comercial: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  avaliacao_score: number | null;
  ultima_avaliacao_em: Date | null;
  proxima_avaliacao_em: Date | null;
  criado_por: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  // joined
  total_entregas?: number;
  entregas_aprovadas?: number;
}

// ─── Lotes e Inspeção ────────────────────────────────────────────────────────

export interface FvmLote {
  id: number;
  tenant_id: number;
  obra_id: number;
  material_id: number;
  fornecedor_id: number;
  numero_lote: string;
  numero_nf: string;
  data_entrega: string; // DATE → string
  hora_chegada: string | null;
  quantidade_nf: number | null;
  quantidade_recebida: number | null;
  unidade: string;
  numero_pedido: string | null;
  lote_fabricante: string | null;
  data_fabricacao: string | null;
  validade: string | null;
  hora_saida_usina: string | null;
  slump_especificado: number | null;
  slump_medido: number | null;
  status: StatusLote;
  inspecionado_por: number | null;
  inspecionado_em: Date | null;
  observacao_geral: string | null;
  quarentena_motivo: string | null;
  quarentena_prazo_dias: number | null;
  quarentena_liberada_por: number | null;
  quarentena_liberada_em: Date | null;
  criado_por: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  // joined
  material_nome?: string;
  fornecedor_nome?: string;
}

export interface FvmLotePreview extends FvmLote {
  material_nome: string;
  fornecedor_nome: string;
  registros_total: number;
  registros_avaliados: number;
  registros_nc: number;
  itens?: FvmItemComRegistro[];
}

export interface FvmItemComRegistro extends FvmItem {
  registro_id: number | null;
  registro_status: StatusRegistro | null;
  registro_observacao: string | null;
}

export interface FvmRegistro {
  id: number;
  tenant_id: number;
  lote_id: number;
  item_id: number;
  status: StatusRegistro;
  observacao: string | null;
  inspecionado_por: number | null;
  inspecionado_em: Date | null;
  created_at: Date;
  updated_at: Date;
  // joined
  item_descricao?: string;
  item_tipo?: TipoItem;
  item_criticidade?: Criticidade;
}

// ─── Grade ────────────────────────────────────────────────────────────────────

export interface FvmGrade {
  materiais: { id: number; nome: string; unidade: string; categoria_nome: string | null }[];
  lotes: {
    id: number;
    numero_lote: string;
    data_entrega: string;
    fornecedor_nome: string;
    quantidade: number;
    unidade: string;
  }[];
  celulas: Record<number, Record<number, StatusLote>>;
  resumo: {
    total_lotes: number;
    aprovados: number;
    aprovados_com_ressalva: number;
    quarentena: number;
    reprovados: number;
    aguardando: number;
    em_inspecao: number;
    cancelados: number;
  };
}
