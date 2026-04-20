// backend/src/ncs/dto/create-nc.dto.ts
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
} from 'class-validator';

export enum NcCategoria {
  CONCRETAGEM = 'CONCRETAGEM',
  FVS = 'FVS',
  FVM = 'FVM',
  ENSAIO = 'ENSAIO',
  GERAL = 'GERAL',
}

export enum NcCriticidade {
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
  BAIXA = 'BAIXA',
}

export class CreateNcDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsEnum(NcCategoria)
  categoria?: NcCategoria;

  @IsOptional()
  @IsEnum(NcCriticidade)
  criticidade?: NcCriticidade;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  responsavel_id?: number;

  @IsOptional()
  @IsDateString()
  prazo?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  // Referência para ged_versoes.id — evidência rastreável no GED.
  // Opcional: NC pode existir sem evidência GED (evidencia_url continua válida por compat).
  @IsOptional()
  @IsInt()
  gedVersaoId?: number;
}
