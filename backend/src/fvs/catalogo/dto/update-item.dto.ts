import { IsString, IsOptional, IsInt, IsEnum, IsBoolean, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Criticidade, FotoModo } from '../../types/fvs.types';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  criterioAceite?: string;

  @IsOptional()
  @IsEnum(['critico', 'maior', 'menor'])
  criticidade?: Criticidade;

  @IsOptional()
  @IsEnum(['nenhuma', 'opcional', 'obrigatoria'])
  fotoModo?: FotoModo;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fotoMinimo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fotoMaximo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
