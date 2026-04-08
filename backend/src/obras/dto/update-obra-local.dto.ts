import { IsString, IsOptional, IsInt, IsObject } from 'class-validator';

export class UpdateObraLocalDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsInt()
  ordem?: number;

  @IsOptional()
  @IsObject()
  dadosExtras?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  dataInicioPrevista?: string;

  @IsOptional()
  @IsString()
  dataFimPrevista?: string;

  @IsOptional()
  @IsInt()
  plantaBaixaId?: number; // FK para GED (futuro)
}
