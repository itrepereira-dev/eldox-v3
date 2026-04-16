// backend/src/ensaios/ia/dto/extrair-laudo-ia.dto.ts
import {
  IsBase64,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ceil(25MB * 4/3) — overhead de codificação base64
const MAX_BASE64_LENGTH = 34_952_534;

export class TipoDisponivel {
  @IsInt() @IsPositive()
  id!: number;

  @IsString() @IsNotEmpty()
  nome!: string;

  @IsString() @IsNotEmpty()
  unidade!: string;
}

export class ExtrairLaudoIaDto {
  @IsBase64()
  @MaxLength(MAX_BASE64_LENGTH, { message: 'PDF excede o limite de 25 MB' })
  arquivo_base64!: string; // PDF em base64

  @IsIn(['application/pdf'])
  mime_type!: string; // somente PDF aceito

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um tipo de ensaio disponível' })
  @ValidateNested({ each: true })
  @Type(() => TipoDisponivel)
  tipos_disponiveis!: TipoDisponivel[];
}
