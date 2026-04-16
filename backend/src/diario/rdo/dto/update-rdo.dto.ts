// backend/src/diario/rdo/dto/update-rdo.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

// Permite atualizar qualquer campo de nível raiz do RDO
export class UpdateRdoDto {
  @IsString()
  @IsOptional()
  observacao_geral?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  responsavel_id?: number;

  @IsArray()
  @IsOptional()
  tags?: string[];
}
