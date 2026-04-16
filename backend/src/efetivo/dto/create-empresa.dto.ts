// backend/src/efetivo/dto/create-empresa.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';

export class CreateEmpresaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;

  @IsOptional()
  @IsEnum(['PROPRIA', 'SUBCONTRATADA'])
  tipo?: 'PROPRIA' | 'SUBCONTRATADA';

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;
}
