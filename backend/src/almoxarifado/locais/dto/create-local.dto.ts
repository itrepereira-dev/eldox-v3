// backend/src/almoxarifado/locais/dto/create-local.dto.ts
import { IsString, IsOptional, IsNumber, IsIn, MaxLength } from 'class-validator';

export class CreateLocalDto {
  @IsIn(['CENTRAL', 'CD', 'DEPOSITO', 'OBRA'])
  tipo!: 'CENTRAL' | 'CD' | 'DEPOSITO' | 'OBRA';

  @IsString()
  @MaxLength(255)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsNumber()
  obra_id?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endereco?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  responsavel_nome?: string | null;
}
