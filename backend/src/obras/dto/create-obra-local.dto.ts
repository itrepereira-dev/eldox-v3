import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
  Min,
  Max,
  IsObject,
} from 'class-validator';

export class CreateObraLocalDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number;

  @IsInt()
  @Min(1)
  @Max(6)
  nivel: number;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nome: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsDateString()
  dataInicioPrevista?: string;

  @IsOptional()
  @IsDateString()
  dataFimPrevista?: string;

  @IsOptional()
  @IsObject()
  dadosExtras?: Record<string, unknown>;
}
