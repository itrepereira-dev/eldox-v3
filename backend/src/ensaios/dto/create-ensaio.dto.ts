// backend/src/ensaios/dto/create-ensaio.dto.ts
import {
  IsInt, IsPositive, IsString, IsNotEmpty, IsOptional,
  IsDateString, IsArray, ValidateNested, IsNumber, Min, Max,
  IsBase64, MaxLength, ArrayMinSize, IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ResultadoDto {
  @IsInt() @IsPositive()
  ensaio_tipo_id!: number;

  @IsNumber() @Min(0)
  valor_obtido!: number;

  @IsOptional() @IsString() @MaxLength(500)
  observacao?: string;
}

export class ArquivoDto {
  @IsBase64()
  base64!: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  nome_original!: string;

  @IsIn(['application/pdf', 'image/jpeg', 'image/png'])
  mime_type!: string;
}

export class CreateEnsaioDto {
  @IsInt() @IsPositive()
  fvm_lote_id!: number;

  @IsInt() @IsPositive()
  laboratorio_id!: number;

  @IsInt() @IsPositive()
  obra_id!: number;

  @IsDateString()
  data_ensaio!: string;

  @IsOptional() @IsString() @MaxLength(50)
  nota_fiscal_ref?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  observacoes?: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => ResultadoDto)
  resultados!: ResultadoDto[];

  @IsOptional() @ValidateNested()
  @Type(() => ArquivoDto)
  arquivo?: ArquivoDto;

  @IsOptional() @IsNumber() @Min(0) @Max(1)
  ia_confianca?: number;

  // Agent F (2026-04-20): versão de documento do GED que define a especificação
  // técnica do ensaio (parâmetros esperados, norma aplicável). Opcional.
  @IsOptional() @IsInt() @IsPositive()
  ged_versao_id_spec?: number;
}

export class ListarEnsaiosQuery {
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt() @IsPositive()
  obra_id!: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt() @IsPositive()
  fvm_lote_id?: number;

  @IsOptional()
  @IsIn(['PENDENTE', 'APROVADO', 'REPROVADO'])
  situacao_revisao?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt() @IsPositive()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt() @IsPositive()
  limit?: number;
}
