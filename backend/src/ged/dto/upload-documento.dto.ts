// src/ged/dto/upload-documento.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsEnum,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { GedEscopo } from '../types/ged.types';

export class UploadDocumentoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  titulo: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  categoriaId: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  pastaId: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  disciplina?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroRevisao?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(['EMPRESA', 'OBRA'])
  escopo?: GedEscopo;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  workflowTemplateId?: number;

  // Código customizado; se omitido, será gerado automaticamente (OBRA-DISC-SEQ)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoCustom?: string;
}
