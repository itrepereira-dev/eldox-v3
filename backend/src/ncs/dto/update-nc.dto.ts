// backend/src/ncs/dto/update-nc.dto.ts
import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsInt,
  IsDateString,
  IsUrl,
} from 'class-validator';
import { NcCategoria, NcCriticidade } from './create-nc.dto';

export enum NcStatus {
  ABERTA = 'ABERTA',
  EM_ANALISE = 'EM_ANALISE',
  TRATAMENTO = 'TRATAMENTO',
  VERIFICACAO = 'VERIFICACAO',
  FECHADA = 'FECHADA',
  CANCELADA = 'CANCELADA',
}

export class UpdateNcDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

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

  @IsOptional()
  @IsEnum(NcStatus)
  status?: NcStatus;

  @IsOptional()
  @IsUrl()
  evidencia_url?: string;

  @IsOptional()
  @IsDateString()
  data_fechamento?: string;
}
