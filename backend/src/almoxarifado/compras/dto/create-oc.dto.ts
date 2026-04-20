// backend/src/almoxarifado/compras/dto/create-oc.dto.ts
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOcItemDto {
  @IsInt()
  @IsPositive()
  catalogo_id!: number;

  @IsNumber()
  @IsPositive()
  quantidade!: number;

  @IsString()
  @MaxLength(20)
  unidade!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preco_unitario?: number;
}

export class CreateOcDto {
  @IsInt()
  @IsPositive()
  local_destino_id!: number; // replaced obra_id

  @IsInt()
  @IsPositive()
  fornecedor_id!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  solicitacao_id?: number;

  @IsOptional()
  @IsDateString()
  prazo_entrega?: string; // ISO date string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  condicao_pgto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  local_entrega?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOcItemDto)
  itens!: CreateOcItemDto[];
}
