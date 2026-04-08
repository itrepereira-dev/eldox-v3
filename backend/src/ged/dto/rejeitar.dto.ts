// src/ged/dto/rejeitar.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class RejeitarDto {
  // Comentário obrigatório ao rejeitar — regra de negócio crítica
  @IsString()
  @MinLength(10, { message: 'O motivo da rejeição deve ter no mínimo 10 caracteres.' })
  @MaxLength(2000)
  comentario: string;
}
