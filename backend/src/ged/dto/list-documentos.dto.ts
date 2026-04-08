// src/ged/dto/list-documentos.dto.ts
import {
  IsOptional,
  IsString,
  IsInt,
  IsEnum,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { GedEscopo, GedStatusVersao } from '../types/ged.types';

export class ListDocumentosDto {
  // Busca genérica — pesquisa em título e código simultaneamente
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  disciplina?: string;

  @IsOptional()
  @IsEnum(['RASCUNHO', 'IFA', 'IFC', 'IFP', 'AS_BUILT', 'REJEITADO', 'OBSOLETO', 'CANCELADO'])
  status?: GedStatusVersao;

  @IsOptional()
  @IsEnum(['EMPRESA', 'OBRA'])
  escopo?: GedEscopo;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pastaId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  categoriaId?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}
