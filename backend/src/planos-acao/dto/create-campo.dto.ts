// backend/src/planos-acao/dto/create-campo.dto.ts
import {
  IsString, IsNotEmpty, IsBoolean, IsOptional, IsIn, IsNumber, MaxLength, Matches, Min,
} from 'class-validator';

export class CreateCampoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'chave deve ser snake_case começando com letra minúscula' })
  chave: string;

  @IsIn(['texto', 'numero', 'data', 'select', 'usuario', 'arquivo'])
  tipo: 'texto' | 'numero' | 'data' | 'select' | 'usuario' | 'arquivo';

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
