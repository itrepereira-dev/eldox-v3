// backend/src/almoxarifado/solicitacao/dto/create-solicitacao.dto.ts

export class CreateSolicitacaoItemDto {
  catalogo_id!: number;
  quantidade!: number;
  unidade!: string;
  observacao?: string;
}

export class CreateSolicitacaoDto {
  local_destino_id!: number;    // replaced obra_id
  descricao!: string;
  urgente?: boolean;
  data_necessidade?: string;
  servico_ref?: string;
  itens!: CreateSolicitacaoItemDto[];
}
