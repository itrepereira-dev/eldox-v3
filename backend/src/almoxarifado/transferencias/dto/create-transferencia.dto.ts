import { IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferenciaItemDto {
  @IsNumber()
  catalogo_id!: number;

  @IsNumber()
  @Min(0.0001)
  quantidade!: number;

  @IsString()
  unidade!: string;
}

export class CreateTransferenciaDto {
  @IsNumber()
  local_origem_id!: number;

  @IsNumber()
  local_destino_id!: number;

  @IsOptional()
  @IsString()
  observacao?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTransferenciaItemDto)
  itens!: CreateTransferenciaItemDto[];
}
