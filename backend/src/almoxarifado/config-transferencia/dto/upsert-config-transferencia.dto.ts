// backend/src/almoxarifado/config-transferencia/dto/upsert-config-transferencia.dto.ts
import { IsNumber, IsArray, IsString, Min } from 'class-validator';

export class UpsertConfigTransferenciaDto {
  @IsNumber()
  @Min(0)
  valor_limite_direto!: number;

  @IsArray()
  @IsString({ each: true })
  roles_aprovadores!: string[];
}
