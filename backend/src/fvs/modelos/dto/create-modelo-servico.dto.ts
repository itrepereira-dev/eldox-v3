// backend/src/fvs/modelos/dto/create-modelo-servico.dto.ts
import { IsNumber, IsOptional, IsArray } from 'class-validator';

export class CreateModeloServicoDto {
  @IsNumber()
  servicoId: number;

  @IsOptional()
  @IsNumber()
  ordem?: number;

  @IsOptional()
  @IsArray()
  itensExcluidos?: number[];
}
