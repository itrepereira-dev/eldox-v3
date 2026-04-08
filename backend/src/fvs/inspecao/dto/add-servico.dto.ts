import { IsArray, IsInt, IsNumber, IsOptional, ArrayNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddServicoDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  servicoId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  localIds: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  itensExcluidos?: number[];
}
