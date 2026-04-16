// backend/src/almoxarifado/estoque/dto/create-movimento.dto.ts
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import type { AlmMovimentoTipo } from '../../types/alm.types';

export class CreateMovimentoDto {
  @IsInt()
  catalogo_id: number;

  @IsEnum(['entrada', 'saida', 'transferencia', 'perda', 'ajuste'])
  tipo: AlmMovimentoTipo;

  @IsNumber()
  @IsPositive()
  quantidade: number;

  @IsString()
  unidade: string;

  @IsInt()
  @IsOptional()
  local_id?: number;

  @IsString()
  @IsOptional()
  referencia_tipo?: string;

  @IsInt()
  @IsOptional()
  referencia_id?: number;

  @IsString()
  @IsOptional()
  observacao?: string;
}
