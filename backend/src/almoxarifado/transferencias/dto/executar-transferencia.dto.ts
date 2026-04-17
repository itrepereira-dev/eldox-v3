import { IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ExecutarTransferenciaItemDto {
  @IsNumber()
  item_id!: number;

  @IsNumber()
  @Min(0.0001)
  qtd_executada!: number;
}

export class ExecutarTransferenciaDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecutarTransferenciaItemDto)
  itens?: ExecutarTransferenciaItemDto[];
}
