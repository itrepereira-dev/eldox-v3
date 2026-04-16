// backend/src/fvm/fornecedores/dto/patch-score.dto.ts
import { IsNumber, Min, Max } from 'class-validator';

export class PatchScoreDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;
}
