// backend/src/planos-acao/dto/transicao.dto.ts
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TransicaoDto {
  @IsNumber()
  @Min(1)
  etapaParaId: number;

  @IsOptional()
  @IsString()
  comentario?: string;

  @IsOptional()
  camposExtras?: Record<string, unknown>;
}
