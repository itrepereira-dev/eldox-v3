// backend/src/planos-acao/dto/create-gatilho.dto.ts
import {
  IsIn, IsOptional, IsNumber, IsString, Min, Max,
} from 'class-validator';

export class CreateGatilhoDto {
  @IsIn(['TAXA_CONFORMIDADE_ABAIXO', 'ITEM_CRITICO_NC', 'NC_ABERTA'])
  condicao: 'TAXA_CONFORMIDADE_ABAIXO' | 'ITEM_CRITICO_NC' | 'NC_ABERTA';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  valorLimiar?: number;

  @IsOptional()
  @IsIn(['critico', 'major', 'minor'])
  @IsString()
  criticidadeMin?: 'critico' | 'major' | 'minor';
}
