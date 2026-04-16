// backend/src/concretagem/concretagens/dto/update-concretagem.dto.ts
import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

export enum StatusConcretagem {
  PROGRAMADA = 'PROGRAMADA',
  EM_LANCAMENTO = 'EM_LANCAMENTO',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}

export class UpdateConcrtagemDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  elemento_estrutural?: string;

  @IsOptional()
  @IsInt()
  obra_local_id?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  volume_previsto?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  traco_especificado?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  fck_especificado?: number;

  @IsOptional()
  @IsInt()
  fornecedor_id?: number;

  @IsOptional()
  @IsDateString()
  data_programada?: string;

  @IsOptional()
  @IsString()
  hora_programada?: string;

  @IsOptional()
  @IsEnum(StatusConcretagem)
  status?: StatusConcretagem;

  @IsOptional()
  @IsInt()
  responsavel_id?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  bombeado?: boolean;

  @IsOptional()
  @IsBoolean()
  liberado_carregamento?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  intervalo_min_caminhoes?: number;
}
