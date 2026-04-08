import { IsString, IsOptional, IsInt, IsEnum, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Criticidade, FotoModo } from '../../types/fvs.types';

export class CreateItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  descricao: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  criterioAceite?: string;

  @IsOptional()
  @IsEnum(['critico', 'maior', 'menor'])
  criticidade?: Criticidade = 'menor';

  @IsOptional()
  @IsEnum(['nenhuma', 'opcional', 'obrigatoria'])
  fotoModo?: FotoModo = 'opcional';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fotoMinimo?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fotoMaximo?: number = 2;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number = 0;
}
