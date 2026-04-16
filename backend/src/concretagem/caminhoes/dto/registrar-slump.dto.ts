// backend/src/concretagem/caminhoes/dto/registrar-slump.dto.ts
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RegistrarSlumpDto {
  @IsNumber()
  @Min(0)
  slump_medido!: number;

  @IsOptional()
  @IsNumber()
  temperatura?: number;

  @IsOptional()
  @IsString()
  incidentes?: string;
}

export class RejeitarCaminhaoDto {
  @IsString()
  motivo!: string;
}
