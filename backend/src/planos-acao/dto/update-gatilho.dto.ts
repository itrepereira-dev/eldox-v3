// backend/src/planos-acao/dto/update-gatilho.dto.ts
import {
  IsOptional, IsBoolean, IsIn, IsNumber, IsString, Min, Max,
} from 'class-validator';

export class UpdateGatilhoDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  valorLimiar?: number;

  @IsOptional()
  @IsIn(['critico', 'major', 'minor'])
  @IsString()
  criticidadeMin?: 'critico' | 'major' | 'minor';

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
