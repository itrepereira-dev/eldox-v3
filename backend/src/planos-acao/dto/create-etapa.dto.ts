// backend/src/planos-acao/dto/create-etapa.dto.ts
import {
  IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional,
  IsArray, Matches, MaxLength, Min,
} from 'class-validator';

export class CreateEtapaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsNumber()
  @Min(0)
  ordem: number;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'cor deve ser hex de 6 dígitos ex: #6B7280' })
  cor?: string;

  @IsOptional()
  @IsBoolean()
  isInicial?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  prazoDias?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rolesTransicao?: string[];
}
