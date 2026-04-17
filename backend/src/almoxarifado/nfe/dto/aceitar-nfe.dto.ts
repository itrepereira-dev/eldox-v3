// backend/src/almoxarifado/nfe/dto/aceitar-nfe.dto.ts
import { IsNumber } from 'class-validator';

export class AceitarNfeDto {
  @IsNumber()
  local_id!: number;

  oc_id?: number;
  observacao?: string;
}

export class RejeitarNfeDto {
  motivo!: string;
}

export class VincularOcDto {
  oc_id!: number;
}

export class ConfirmarMatchDto {
  catalogo_id!: number;
}
