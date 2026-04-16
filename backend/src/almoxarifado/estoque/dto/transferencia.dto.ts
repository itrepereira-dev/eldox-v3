// backend/src/almoxarifado/estoque/dto/transferencia.dto.ts
import { IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class TransferenciaDto {
  @IsInt()
  catalogo_id: number;

  @IsNumber()
  @IsPositive()
  quantidade: number;

  @IsString()
  unidade: string;

  @IsInt()
  @IsOptional()
  local_origem_id?: number;

  /** obraId de destino — pode ser diferente da obra de origem */
  @IsInt()
  obra_destino_id: number;

  @IsInt()
  @IsOptional()
  local_destino_id?: number;

  @IsString()
  @IsOptional()
  observacao?: string;
}
