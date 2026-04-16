// backend/src/efetivo/dto/patch-item.dto.ts
import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
