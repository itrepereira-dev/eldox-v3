// backend/src/fvs/dashboard/relatorio-uso-query.dto.ts
import { IsOptional, IsDateString } from 'class-validator';

export class RelatorioUsoQueryDto {
  @IsOptional()
  @IsDateString()
  data_inicio?: string;

  @IsOptional()
  @IsDateString()
  data_fim?: string;
}
