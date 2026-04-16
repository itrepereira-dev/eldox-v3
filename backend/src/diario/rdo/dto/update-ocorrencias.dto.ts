// backend/src/diario/rdo/dto/update-ocorrencias.dto.ts
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class OcorrenciaItemDto {
  @IsString()
  descricao: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsNumber()
  @IsOptional()
  tipo_ocorrencia_id?: number;
}

export class UpdateOcorrenciasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OcorrenciaItemDto)
  itens: OcorrenciaItemDto[];
}
