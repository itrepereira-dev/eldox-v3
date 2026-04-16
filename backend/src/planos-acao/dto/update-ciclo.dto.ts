// backend/src/planos-acao/dto/update-ciclo.dto.ts
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateCicloDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
