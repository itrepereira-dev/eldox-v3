// backend/src/almoxarifado/planejamento/dto/upsert-planejamento.dto.ts
import { IsInt, IsPositive, IsNumber, Min, IsOptional, IsString, Max } from 'class-validator';

export class UpsertPlanejamentoDto {
  @IsInt()
  catalogo_id!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsInt()
  @Min(2020)
  ano!: number;

  @IsNumber()
  @IsPositive()
  quantidade!: number;

  @IsOptional()
  @IsString()
  observacao?: string;
}
