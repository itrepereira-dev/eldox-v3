// backend/src/efetivo/dto/query-efetivo.dto.ts
import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEfetivoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  ano?: number;

  @IsOptional()
  @IsEnum(['INTEGRAL', 'MANHA', 'TARDE', 'NOITE'])
  turno?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
