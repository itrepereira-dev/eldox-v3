// backend/src/diario/rdo/dto/update-checklist.dto.ts
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChecklistItemDto {
  @IsString()
  descricao: string;

  @IsBoolean()
  marcado: boolean;

  @IsNumber()
  @IsOptional()
  ordem?: number;
}

export class UpdateChecklistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  itens: ChecklistItemDto[];
}
