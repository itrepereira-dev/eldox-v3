import { IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';

export class CreateCategoriaDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome!: string;

  @IsOptional() @IsString() @MaxLength(300)
  descricao?: string;

  @IsOptional() @IsString() @MaxLength(50)
  icone?: string;

  @IsOptional() @IsInt() @Min(0)
  ordem?: number;
}
