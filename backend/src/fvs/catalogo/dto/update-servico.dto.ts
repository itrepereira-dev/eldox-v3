import { IsString, IsOptional, IsInt, IsBoolean, IsArray, ValidateNested, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateItemDto } from './create-item.dto';

export class UpdateServicoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  categoriaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  normaReferencia?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  /** Quando enviado, SUBSTITUI todos os itens do serviço (delete + re-insert). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  itens?: CreateItemDto[];
}
