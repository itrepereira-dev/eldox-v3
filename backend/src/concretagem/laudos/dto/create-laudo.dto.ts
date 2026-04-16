// backend/src/concretagem/laudos/dto/create-laudo.dto.ts
import { IsInt, IsString, IsOptional, IsDateString, IsEnum, MaxLength } from 'class-validator';

export enum TipoLaudo {
  CONCRETO = 'CONCRETO',
  ACO = 'ACO',
  SOLO = 'SOLO',
  ARGAMASSA = 'ARGAMASSA',
  OUTRO = 'OUTRO',
}

export enum ResultadoLaudo {
  PENDENTE = 'PENDENTE',
  APROVADO = 'APROVADO',
  REPROVADO = 'REPROVADO',
}

export class CreateLaudoDto {
  @IsInt()
  concretagem_id!: number;

  @IsString()
  @MaxLength(50)
  numero!: string;

  @IsOptional()
  @IsEnum(TipoLaudo)
  tipo?: TipoLaudo;

  @IsDateString()
  data_emissao!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  laboratorio_nome?: string;

  @IsOptional()
  @IsInt()
  laboratorio_id?: number;

  @IsOptional()
  @IsString()
  arquivo_url?: string;

  @IsOptional()
  @IsInt()
  ged_documento_id?: number;

  @IsOptional()
  @IsEnum(ResultadoLaudo)
  resultado?: ResultadoLaudo;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
