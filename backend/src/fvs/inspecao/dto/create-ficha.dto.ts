import { IsString, IsNotEmpty, IsEnum, IsNumber, IsArray, IsOptional, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class ServicoFichaDto {
  @IsNumber()
  servicoId: number;

  @IsArray()
  @ArrayNotEmpty()
  localIds: number[];

  @IsOptional()
  @IsArray()
  itensExcluidos?: number[];
}

export class CreateFichaDto {
  @IsNumber()
  obraId: number;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(['pbqph', 'norma_tecnica', 'livre'])
  regime: 'pbqph' | 'norma_tecnica' | 'livre';

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ServicoFichaDto)
  servicos: ServicoFichaDto[];
}

export type CreateFichaDtoServico = ServicoFichaDto;
