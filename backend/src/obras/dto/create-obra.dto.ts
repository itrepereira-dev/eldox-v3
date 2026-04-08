import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
  Min,
  IsObject,
} from 'class-validator';
import { ModoQualidade } from '@prisma/client';

export class CreateObraDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  nome: string;

  @IsInt()
  @Min(1)
  obraTipoId: number;

  @IsOptional()
  @IsEnum(ModoQualidade)
  modoQualidade?: ModoQualidade;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endereco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  estado?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}-\d{3}$/, { message: 'CEP deve estar no formato NNNNN-NNN' })
  cep?: string;

  @IsOptional()
  @IsDateString()
  dataInicioPrevista?: string;

  @IsOptional()
  @IsDateString()
  dataFimPrevista?: string;

  @IsOptional()
  @IsObject()
  dadosExtras?: Record<string, unknown>;
}
