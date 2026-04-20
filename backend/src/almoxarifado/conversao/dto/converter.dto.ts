// backend/src/almoxarifado/conversao/dto/converter.dto.ts
import { IsString, IsOptional, IsNumber, IsPositive, MaxLength } from 'class-validator';

export class ConverterDto {
  @IsOptional()
  @IsNumber()
  catalogoId?: number | null;

  @IsNumber()
  @IsPositive()
  quantidade!: number;

  @IsString()
  @MaxLength(20)
  unidadeOrigem!: string;

  @IsString()
  @MaxLength(20)
  unidadeDestino!: string;
}
