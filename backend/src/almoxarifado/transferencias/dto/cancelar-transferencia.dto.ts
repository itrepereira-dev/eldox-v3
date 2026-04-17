import { IsOptional, IsString } from 'class-validator';

export class CancelarTransferenciaDto {
  @IsOptional()
  @IsString()
  motivo?: string | null;
}
