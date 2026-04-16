// backend/src/almoxarifado/compras/dto/receber-oc.dto.ts

export class ReceberOcItemDto {
  item_id!: number;
  qtd_recebida!: number;
  local_id?: number;
}

export class ReceberOcDto {
  itens!: ReceberOcItemDto[];
}
