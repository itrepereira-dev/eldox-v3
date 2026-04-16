// backend/src/fvm/recebimento/dto/ensaio.dto.ts
import { IsInt, IsOptional, IsString, IsNumber, IsDateString, Min } from 'class-validator';

export class RegistrarEnsaioDto {
  @IsOptional()
  @IsInt()
  template_id?: number;

  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  norma_referencia?: string;

  @IsString()
  unidade!: string;

  @IsOptional()
  @IsNumber()
  valor_min?: number;

  @IsOptional()
  @IsNumber()
  valor_max?: number;

  @IsOptional()
  @IsNumber()
  valor_medido?: number;

  @IsOptional()
  @IsDateString()
  data_ensaio?: string;

  @IsOptional()
  @IsString()
  laboratorio_nome?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
