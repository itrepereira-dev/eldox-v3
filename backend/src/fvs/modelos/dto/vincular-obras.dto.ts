// backend/src/fvs/modelos/dto/vincular-obras.dto.ts
import { IsArray, IsNumber } from 'class-validator';

export class VincularObrasDto {
  @IsArray()
  @IsNumber({}, { each: true })
  obraIds: number[];
}
