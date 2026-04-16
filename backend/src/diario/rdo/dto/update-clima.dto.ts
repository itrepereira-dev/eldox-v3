// backend/src/diario/rdo/dto/update-clima.dto.ts
import {
  IsEnum,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PeriodoDia, CondicaoClima } from '../types/rdo.types';

class ClimaItemDto {
  @IsEnum(['manha', 'tarde', 'noite'])
  periodo: PeriodoDia;

  @IsEnum(['ensolarado', 'nublado', 'chuvoso', 'parcialmente_nublado', 'tempestade'])
  condicao: CondicaoClima;

  @IsBoolean()
  praticavel: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(999)
  chuva_mm?: number;

  @IsBoolean()
  aplicado_pelo_usuario: boolean;
}

export class UpdateClimaDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ClimaItemDto)
  itens: ClimaItemDto[];
}
