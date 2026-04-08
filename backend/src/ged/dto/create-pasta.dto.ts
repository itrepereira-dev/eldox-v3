// src/ged/dto/create-pasta.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { GedEscopo } from '../types/ged.types';

export class CreatePastaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nome: string;

  @IsEnum(['EMPRESA', 'OBRA'])
  escopo: GedEscopo;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  parentId?: number;

  // Configurações próprias da pasta (herdadas pelo children via settings_efetivos)
  @IsOptional()
  @IsObject()
  configuracoes?: Record<string, unknown>;
}
