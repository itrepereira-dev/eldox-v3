// backend/src/diario/rdo/dto/aplicar-sugestao.dto.ts
import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import type { AcaoSugestaoIa } from '../types/rdo.types';

export class AplicarSugestaoDto {
  @IsString()
  @IsNotEmpty()
  agente: string;

  @IsString()
  @IsNotEmpty()
  campo: string;

  // Aceita qualquer valor (string, number, object, array)
  valor_aplicado: any;

  @IsEnum(['aplicou', 'ignorou', 'editou'])
  acao: AcaoSugestaoIa;
}
