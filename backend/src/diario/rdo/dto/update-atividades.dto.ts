// backend/src/diario/rdo/dto/update-atividades.dto.ts
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class AtividadeItemDto {
  @IsString()
  descricao: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  progresso_pct?: number;

  @IsNumber()
  @IsOptional()
  ordem?: number;

  @IsString()
  @IsOptional()
  hora_inicio?: string;

  @IsString()
  @IsOptional()
  hora_fim?: string;

  @IsNumber()
  @IsOptional()
  etapa_tarefa_id?: number;

  // Agent F (2026-04-20): versão de documento do GED que embasa a execução
  // (projeto, especificação, procedimento executivo). Opcional.
  @IsNumber()
  @IsOptional()
  ged_versao_id?: number;
}

export class UpdateAtividadesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtividadeItemDto)
  itens: AtividadeItemDto[];
}
