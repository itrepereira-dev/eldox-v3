// backend/src/fvs/modelos/dto/update-modelo-servico.dto.ts
import { IsNumber, IsOptional, IsArray, IsObject } from 'class-validator';

export class UpdateModeloServicoDto {
  @IsOptional()
  @IsNumber()
  ordem?: number;

  @IsOptional()
  @IsArray()
  itensExcluidos?: number[] | null;

  @IsOptional()
  @IsObject()
  itemFotos?: Record<string, number>;
}
