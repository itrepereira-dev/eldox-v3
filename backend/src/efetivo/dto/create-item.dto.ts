// backend/src/efetivo/dto/create-item.dto.ts
import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateItemDto {
  @IsInt()
  @Min(1)
  empresaId: number;

  @IsInt()
  @Min(1)
  funcaoId: number;

  @IsInt()
  @Min(1)
  quantidade: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
