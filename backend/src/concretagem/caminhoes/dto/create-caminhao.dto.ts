// backend/src/concretagem/caminhoes/dto/create-caminhao.dto.ts
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCaminhaoDto {
  @IsString()
  @MaxLength(50)
  numero_nf!: string;

  @IsDateString()
  data_emissao_nf!: string;

  @IsNumber()
  @Min(0.1)
  volume!: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  motorista?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  placa?: string;

  @IsOptional()
  @IsString()
  hora_chegada?: string;

  @IsOptional()
  @IsString()
  hora_inicio_lancamento?: string;

  @IsOptional()
  @IsString()
  hora_fim_lancamento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  elemento_lancado?: string;

  @IsOptional()
  @IsNumber()
  slump_especificado?: number;

  @IsOptional()
  @IsNumber()
  slump_medido?: number;

  @IsOptional()
  @IsNumber()
  temperatura?: number;

  @IsOptional()
  @IsString()
  incidentes?: string;

  @IsOptional()
  @IsBoolean()
  nao_descarregou?: boolean;

  @IsOptional()
  @IsBoolean()
  responsabilidade_concreteira?: boolean;

  @IsOptional()
  @IsBoolean()
  lacre_aprovado?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fator_ac?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  flow?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ensaio_j?: number;

  @IsOptional()
  @IsEnum(['APROVEITADO', 'DESCARTADO', 'NAO_PAGAR'])
  sobra_tipo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sobra_volume?: number;

  @IsOptional()
  @IsString()
  foto_nf_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numero_bt?: string;

  @IsOptional()
  @IsString()
  hora_carregamento?: string;

  @IsOptional()
  @IsBoolean()
  lancamento_parcial?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  elementos_lancados?: string[];
}
