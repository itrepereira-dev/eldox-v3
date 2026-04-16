// backend/src/efetivo/types/efetivo.types.ts

export type TurnoEfetivo = 'INTEGRAL' | 'MANHA' | 'TARDE' | 'NOITE';
export type TipoEmpresa  = 'PROPRIA' | 'SUBCONTRATADA';

export interface EmpresaEfetivo {
  id:        number;
  tenant_id: number;
  nome:      string;
  tipo:      TipoEmpresa;
  cnpj:      string | null;
  ativa:     boolean;
  criado_em: Date;
}

export interface FuncaoEfetivo {
  id:        number;
  tenant_id: number;
  nome:      string;
  ativa:     boolean;
  criado_em: Date;
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
  id:            number;
  tenant_id:     number;
  obra_id:       number;
  data:          string;
  turno:         TurnoEfetivo;
  fechado:       boolean;
  fechado_por:   number | null;
  fechado_em:    Date | null;
  criado_por:    number;
  criado_em:     Date;
  atualizado_em: Date;
  rdo_id:        number | null;
  itens?:        ItemEfetivo[];
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
  confianca:    number; // 0-100
  base_registros: number;
  observacao:   string;
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
  criado_em:  Date;
}
