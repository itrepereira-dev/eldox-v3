import { IsString, IsOptional, IsInt, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoriaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number = 0;
}
