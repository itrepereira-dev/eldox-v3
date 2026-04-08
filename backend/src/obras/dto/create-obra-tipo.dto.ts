import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ObraTipoNivelInput {
  @IsInt()
  @Min(1)
  @Max(6)
  numero: number;

  @IsString()
  @MaxLength(50)
  labelSingular: string;

  @IsString()
  @MaxLength(50)
  labelPlural: string;

  @IsOptional()
  @IsBoolean()
  geracaoEmMassa?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  prefixoPadrao?: string;
}

export class CreateObraTipoDto {
  @IsString()
  @MaxLength(255)
  nome: string;

  @IsString()
  @MaxLength(50)
  slug: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsInt()
  @Min(1)
  @Max(6)
  totalNiveis: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObraTipoNivelInput)
  niveis: ObraTipoNivelInput[];
}
