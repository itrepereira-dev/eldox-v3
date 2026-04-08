import { IsEnum, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';

export class UpsertQualityConfigDto {
  @IsOptional()
  @IsEnum(['SIMPLES', 'PBQPH'])
  modoQualidade?: 'SIMPLES' | 'PBQPH';

  @IsOptional()
  @IsInt()
  @Min(1)
  slaAprovacaoHoras?: number;

  @IsOptional()
  @IsBoolean()
  exigeAssinaturaFVS?: boolean;

  @IsOptional()
  @IsBoolean()
  exigeAssinaturaDiario?: boolean;
}
