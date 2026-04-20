// backend/src/almoxarifado/conversao/dto/upsert-conversao.dto.ts
import { IsString, IsOptional, IsNumber, IsPositive, MaxLength, MinLength } from 'class-validator';

export class UpsertConversaoDto {
  @IsOptional()
  @IsNumber()
  catalogoId?: number | null;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unidadeOrigem!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unidadeDestino!: string;

  @IsNumber()
  @IsPositive()
  fator!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  descricao?: string | null;
}
