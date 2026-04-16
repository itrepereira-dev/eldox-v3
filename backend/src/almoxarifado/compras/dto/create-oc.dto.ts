// backend/src/almoxarifado/compras/dto/create-oc.dto.ts

export class CreateOcItemDto {
  catalogo_id!: number;
  quantidade!: number;
  unidade!: string;
  preco_unitario?: number;
}

export class CreateOcDto {
  fornecedor_id!: number;
  solicitacao_id?: number;
  prazo_entrega?: string;   // ISO date string
  condicao_pgto?: string;
  local_entrega?: string;
  observacoes?: string;
  itens!: CreateOcItemDto[];
}
