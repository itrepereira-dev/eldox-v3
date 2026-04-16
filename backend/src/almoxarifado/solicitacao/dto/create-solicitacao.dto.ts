// backend/src/almoxarifado/solicitacao/dto/create-solicitacao.dto.ts

export class CreateSolicitacaoItemDto {
  catalogo_id!: number;
  quantidade!: number;
  unidade!: string;
  observacao?: string;
}

export class CreateSolicitacaoDto {
  descricao!: string;
  urgente?: boolean;
  data_necessidade?: string; // ISO date string
  servico_ref?: string;
  itens!: CreateSolicitacaoItemDto[];
}
