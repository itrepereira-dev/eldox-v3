// backend/src/almoxarifado/conversao/dto/calcular-compra.dto.ts
import { IsString, IsOptional, IsNumber, IsPositive, Min, Max, MaxLength } from 'class-validator';

export class CalcularCompraDto {
  @IsOptional()
  @IsNumber()
  catalogoId?: number | null;

  /** Quantidade necessária, na UM em que o orçamento/FVS mediu (ex: 250 m²) */
  @IsNumber()
  @IsPositive()
  necessidade!: number;

  /** UM da necessidade (ex: 'M2', 'KG', 'L') */
  @IsString()
  @MaxLength(20)
  unidadeNecessidade!: string;

  /** UM em que o fornecedor vende (ex: 'CX', 'SC', 'GL', 'ROL') */
  @IsString()
  @MaxLength(20)
  unidadeCompra!: string;

  /** Percentual de quebra técnica (0-100). Ex: 10 = +10% pra cobrir perdas */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  quebraPct?: number;
}
