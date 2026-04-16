// backend/src/concretagem/croqui/dto/create-croqui.dto.ts
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  IsPositive,
  IsNumber,
  IsIn,
  Min,
  Max,
  ValidateNested,
  IsObject,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ElementoCroquiDto {
  @IsString() @IsNotEmpty() @MaxLength(50)
  id!: string; // label único, ex: "A1-B2"

  @IsIn(['painel_laje', 'pilar', 'viga', 'outro'])
  tipo!: 'painel_laje' | 'pilar' | 'viga' | 'outro';

  @IsString() @IsNotEmpty() @MaxLength(50)
  label!: string;

  @IsInt() @Min(0) col!: number;
  @IsInt() @Min(0) row!: number;
  @IsInt() @Min(1) colspan!: number;
  @IsInt() @Min(1) rowspan!: number;
}

export class ElementosDto {
  @IsArray() @IsString({ each: true })
  eixos_x!: string[];

  @IsArray() @IsString({ each: true })
  eixos_y!: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Croqui deve ter ao menos 1 elemento' })
  @ValidateNested({ each: true })
  @Type(() => ElementoCroquiDto)
  elementos!: ElementoCroquiDto[];
}

export class CreateCroquiDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  nome!: string;

  @IsOptional() @IsInt() @IsPositive()
  obra_local_id?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => ElementosDto)
  elementos!: ElementosDto;

  @IsOptional()
  @IsNumber()
  @Min(0) @Max(1)
  ia_confianca?: number;
}
