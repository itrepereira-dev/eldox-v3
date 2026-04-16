// backend/src/concretagem/concretagens/dto/create-concretagem.dto.ts
import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateConcrtagemDto {
  @IsString()
  @MaxLength(200)
  elemento_estrutural!: string;

  @IsOptional()
  @IsInt()
  obra_local_id?: number;

  @IsNumber()
  @Min(0.1)
  volume_previsto!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  traco_especificado?: string;

  @IsInt()
  @Min(10)
  fck_especificado!: number;

  @IsInt()
  fornecedor_id!: number;

  @IsDateString()
  data_programada!: string;

  @IsOptional()
  @IsString()
  hora_programada?: string;

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
