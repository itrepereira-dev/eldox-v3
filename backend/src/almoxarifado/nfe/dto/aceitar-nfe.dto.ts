// backend/src/almoxarifado/nfe/dto/aceitar-nfe.dto.ts
import { IsNumber, IsOptional, IsString, IsPositive } from 'class-validator';

export class AceitarNfeDto {
  @IsNumber()
  local_id!: number;

  @IsOptional()
  @IsNumber()
  oc_id?: number;

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class RejeitarNfeDto {
  @IsString()
  motivo!: string;
}

export class VincularOcDto {
  @IsNumber()
  @IsPositive()
  oc_id!: number;
}

export class ConfirmarMatchDto {
  @IsNumber()
  @IsPositive()
  catalogo_id!: number;
}
