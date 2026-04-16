// backend/src/concretagem/racs/dto/create-rac.dto.ts
import { IsInt, IsString, IsOptional, IsDateString, MaxLength, IsEnum } from 'class-validator';

export enum RacStatus {
  ABERTA = 'ABERTA',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}

export class CreateRacDto {
  @IsInt()
  obra_id!: number;

  @IsOptional()
  @IsInt()
  nc_id?: number;

  @IsString()
  @MaxLength(300)
  titulo!: string;

  @IsString()
  descricao_problema!: string;

  @IsOptional()
  @IsString()
  causa_raiz?: string;

  @IsOptional()
  @IsString()
  acao_corretiva?: string;

  @IsOptional()
  @IsString()
  acao_preventiva?: string;

  @IsOptional()
  @IsInt()
  responsavel_id?: number;

  @IsOptional()
  @IsDateString()
  prazo?: string;
}
