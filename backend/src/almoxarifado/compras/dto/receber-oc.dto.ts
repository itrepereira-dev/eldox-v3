// backend/src/almoxarifado/compras/dto/receber-oc.dto.ts
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceberOcItemDto {
  @IsInt()
  @IsPositive()
  item_id!: number;

  @IsNumber()
  @IsPositive()
  qtd_recebida!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  local_id?: number;
}

export class ReceberOcDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceberOcItemDto)
  itens!: ReceberOcItemDto[];
}
