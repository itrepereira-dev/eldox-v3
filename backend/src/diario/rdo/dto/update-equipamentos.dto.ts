// backend/src/diario/rdo/dto/update-equipamentos.dto.ts
import {
  IsString,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

class EquipamentoItemDto {
  @IsString()
  nome: string;

  @IsInt()
  @IsPositive()
  quantidade: number;

  @IsInt()
  @IsOptional()
  do_catalogo_id?: number;
}

export class UpdateEquipamentosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EquipamentoItemDto)
  itens: EquipamentoItemDto[];
}
