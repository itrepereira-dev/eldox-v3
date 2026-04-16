// backend/src/concretagem/corpos-de-prova/dto/registrar-ruptura.dto.ts
import { IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';

export class RegistrarRupturaDto {
  @IsNumber()
  @Min(0)
  resistencia!: number;

  @IsOptional()
  @IsDateString()
  data_ruptura_real?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
