// backend/src/fvm/recebimento/evidencias/dto/vincular-evidencia.dto.ts
import { IsInt, IsPositive, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum TipoEvidencia {
  FOTO         = 'foto',
  NF           = 'nf',
  CERTIFICADO  = 'certificado',
  LAUDO        = 'laudo',
  FICHA_TECNICA = 'ficha_tecnica',
  OUTRO        = 'outro',
}

export class VincularEvidenciaDto {
  @IsInt()
  @IsPositive()
  ged_versao_id: number;

  @IsEnum(TipoEvidencia)
  tipo: TipoEvidencia;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descricao?: string;
}
