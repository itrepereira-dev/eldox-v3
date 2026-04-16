// backend/src/almoxarifado/nfe/dto/aceitar-nfe.dto.ts

export class AceitarNfeDto {
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
