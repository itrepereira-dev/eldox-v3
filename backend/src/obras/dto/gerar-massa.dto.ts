import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class GerarMassaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number;

  @IsInt()
  @Min(1)
  @Max(6)
  nivel: number;

  @IsString()
  @MaxLength(20)
  prefixo: string;

  @IsInt()
  @Min(1)
  @Max(500)
  quantidade: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  inicioEm?: number;
}
