import { IsOptional, IsNumber, IsString, IsEnum, IsBoolean, IsArray, Min, MaxLength } from 'class-validator';

export class PatchCaminhaoDto {
  @IsOptional() @IsNumber() @Min(0) fator_ac?: number;
  @IsOptional() @IsNumber() @Min(0) flow?: number;
  @IsOptional() @IsNumber() @Min(0) ensaio_j?: number;
  @IsOptional() @IsEnum(['APROVEITADO', 'DESCARTADO', 'NAO_PAGAR']) sobra_tipo?: string;
  @IsOptional() @IsNumber() @Min(0) sobra_volume?: number;
  @IsOptional() @IsString() @MaxLength(500) foto_nf_url?: string;

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
