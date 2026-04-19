// backend/src/fvs/inspecao/dto/create-ficha.dto.ts
import {
  IsString, IsNotEmpty, IsEnum, IsNumber, IsArray, IsOptional,
  ValidateNested, ArrayNotEmpty, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

class ServicoFichaDto {
  @IsNumber()
  servicoId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
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

  @IsOptional()
  @IsNumber()
  modeloId?: number;

  // Locais para todos os serviços do template (usado quando modeloId está presente)
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  localIds?: number[];

  // Obrigatório apenas quando modeloId não fornecido
  @ValidateIf((o) => !o.modeloId)
  @IsEnum(['pbqph', 'norma_tecnica', 'livre'])
  regime?: 'pbqph' | 'norma_tecnica' | 'livre';

  // Obrigatório apenas quando modeloId não fornecido
  @ValidateIf((o) => !o.modeloId)
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ServicoFichaDto)
  servicos?: ServicoFichaDto[];
}

export type CreateFichaDtoServico = ServicoFichaDto;
