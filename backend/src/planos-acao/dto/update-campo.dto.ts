// backend/src/planos-acao/dto/update-campo.dto.ts
import {
  IsString, IsOptional, IsBoolean, IsIn, IsNumber, MaxLength, Matches, Min,
} from 'class-validator';

export class UpdateCampoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsIn(['texto', 'numero', 'data', 'select', 'usuario', 'arquivo'])
  tipo?: 'texto' | 'numero' | 'data' | 'select' | 'usuario' | 'arquivo';

  @IsOptional()
  opcoes?: string[];

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ordem?: number;
}
