// backend/src/ensaios/tipos/dto/update-tipo.dto.ts
import {
  IsString, IsNotEmpty, MaxLength, IsOptional,
  IsNumber, IsInt, Min, IsIn, ValidateNested, IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateFrequenciaDto } from './create-frequencia.dto';

export class UpdateTipoDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(20)
  unidade?: string;

  @IsOptional() @IsNumber()
  valor_ref_min?: number | null;

  @IsOptional() @IsNumber()
  valor_ref_max?: number | null;

  @IsOptional() @IsString() @MaxLength(50)
  norma_tecnica?: string;

  @IsOptional()
  @IsIn(['bloco_concreto', 'concreto', 'argamassa', 'aco', 'ceramica', 'outro'])
  material_tipo?: string;

  @IsOptional() @IsInt() @Min(1)
  fvm_material_id?: number | null;

  @IsOptional() @ValidateNested()
  @Type(() => CreateFrequenciaDto)
  frequencia?: CreateFrequenciaDto;
}
