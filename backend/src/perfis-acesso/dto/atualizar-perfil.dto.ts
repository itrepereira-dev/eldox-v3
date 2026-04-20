import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
