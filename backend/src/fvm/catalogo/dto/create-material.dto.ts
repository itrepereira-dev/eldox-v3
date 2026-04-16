import {
  IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min,
  IsBoolean, IsIn, IsNumber,
} from 'class-validator';

export class CreateMaterialDto {
  @IsInt() @Min(1)
  categoria_id!: number;

  @IsString() @IsNotEmpty() @MaxLength(200)
  nome!: string;

  @IsOptional() @IsString() @MaxLength(50)
  codigo?: string;

  @IsOptional() @IsString() @MaxLength(200)
  norma_referencia?: string;

  @IsOptional() @IsString() @MaxLength(20)
  unidade?: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsOptional() @IsIn(['nenhuma', 'opcional', 'obrigatoria'])
  foto_modo?: string;

  @IsOptional() @IsBoolean()
  exige_certificado?: boolean;

  @IsOptional() @IsBoolean()
  exige_nota_fiscal?: boolean;

  @IsOptional() @IsBoolean()
  exige_laudo_ensaio?: boolean;

  @IsOptional() @IsInt() @Min(0)
  prazo_quarentena_dias?: number;

  @IsOptional() @IsInt() @Min(0)
  ordem?: number;
}
