import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarPerfilDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
