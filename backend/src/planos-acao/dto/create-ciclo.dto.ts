// backend/src/planos-acao/dto/create-ciclo.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';

export class CreateCicloDto {
  @IsIn(['FVS', 'FVM', 'NC'])
  modulo: 'FVS' | 'FVM' | 'NC';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
