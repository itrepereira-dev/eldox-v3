// backend/src/diario/rdo/dto/update-mao-obra.dto.ts
import {
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayNotEmpty,
  IsPositive,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { TipoMaoObra } from '../types/rdo.types';

class MaoObraItemDto {
  @IsString()
  funcao: string;

  @IsInt()
  @IsPositive()
  quantidade: number;

  @IsEnum(['proprio', 'subcontratado', 'terceirizado'])
  tipo: TipoMaoObra;

  @IsString()
  @IsOptional()
  nome_personalizado?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'hora_entrada deve estar no formato HH:MM' })
  hora_entrada?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'hora_saida deve estar no formato HH:MM' })
  hora_saida?: string;
}

export class UpdateMaoObraDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MaoObraItemDto)
  itens: MaoObraItemDto[];
}
