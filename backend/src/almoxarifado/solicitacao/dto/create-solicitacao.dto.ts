// backend/src/almoxarifado/solicitacao/dto/create-solicitacao.dto.ts
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSolicitacaoItemDto {
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
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

export class CreateSolicitacaoDto {
  @IsInt()
  @IsPositive()
  local_destino_id!: number; // replaced obra_id

  @IsString()
  @MaxLength(2000)
  descricao!: string;

  @IsOptional()
  @IsBoolean()
  urgente?: boolean;

  @IsOptional()
  @IsDateString()
  data_necessidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  servico_ref?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSolicitacaoItemDto)
  itens!: CreateSolicitacaoItemDto[];
}
