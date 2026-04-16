// backend/src/ensaios/laboratorios/dto/create-laboratorio.dto.ts
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateLaboratorioDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(200)
  nome!: string;

  @IsOptional() @IsString() @MaxLength(18)
  cnpj?: string;

  @IsOptional() @IsString() @MaxLength(100)
  contato?: string;
}
