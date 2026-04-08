import { IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  id: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem: number;
}

export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  itens: ReorderItemDto[];
}
