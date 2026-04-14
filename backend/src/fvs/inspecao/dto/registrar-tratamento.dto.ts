// backend/src/fvs/inspecao/dto/registrar-tratamento.dto.ts
import {
  IsString, MaxLength, IsNumber, IsDateString, IsOptional, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class EvidenciaDto {
  @IsNumber()
  gedVersaoId: number;

  @IsOptional()
  @IsString()
  descricao?: string;
}

export class RegistrarTratamentoDto {
  @IsString()
  @MaxLength(500)
  descricao: string;

  @IsString()
  @MaxLength(500)
  acaoCorretiva: string;

  @IsNumber()
  responsavelId: number;

  @IsDateString()
  prazo: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenciaDto)
  evidencias?: EvidenciaDto[];
}
