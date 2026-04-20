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

  // Agent F (2026-04-20): versão de documento do GED usada como projeto de
  // referência da inspeção (planta aprovada, memorial etc). Opcional.
  @IsOptional()
  @IsNumber()
  gedVersaoIdProjeto?: number;
}

export type CreateFichaDtoServico = ServicoFichaDto;
