import { IsString, IsOptional, IsInt, IsBoolean, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCategoriaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
