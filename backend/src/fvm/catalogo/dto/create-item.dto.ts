import {
  IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min,
  IsIn,
} from 'class-validator';

export class CreateItemDto {
  @IsIn(['visual', 'documental', 'dimensional', 'ensaio'])
  tipo!: string;

  @IsString() @IsNotEmpty() @MaxLength(300)
  descricao!: string;

  @IsOptional() @IsString()
  criterio_aceite?: string;

  @IsOptional() @IsIn(['critico', 'maior', 'menor'])
  criticidade?: string;

  @IsOptional() @IsIn(['nenhuma', 'opcional', 'obrigatoria'])
  foto_modo?: string;

  @IsOptional() @IsInt() @Min(0)
  ordem?: number;
}
