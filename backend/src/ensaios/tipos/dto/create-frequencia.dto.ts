// backend/src/ensaios/tipos/dto/create-frequencia.dto.ts
import { IsIn, IsInt, Min } from 'class-validator';

export class CreateFrequenciaDto {
  @IsIn(['dias', 'm3', 'lotes'])
  unidade_frequencia!: string;

  @IsInt() @Min(1)
  valor!: number;
}
