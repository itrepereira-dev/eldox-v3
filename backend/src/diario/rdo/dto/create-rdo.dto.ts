// backend/src/diario/rdo/dto/create-rdo.dto.ts
import {
  IsInt,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsString,
  IsPositive,
} from 'class-validator';

export class CreateRdoDto {
  @IsInt()
  @IsPositive()
  obra_id: number;

  @IsDateString()
  data: string; // YYYY-MM-DD

  @IsBoolean()
  @IsOptional()
  copiar_ultimo?: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  copiar_campos?: string[]; // ['clima', 'equipe', 'atividades']
}
