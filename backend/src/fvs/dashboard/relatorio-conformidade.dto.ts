// backend/src/fvs/dashboard/relatorio-conformidade.dto.ts
import { IsOptional, IsNumberString, IsDateString } from 'class-validator';

export class RelatorioConformidadeQueryDto {
  @IsOptional()
  @IsNumberString()
  servico_id?: string;

  @IsOptional()
  @IsDateString()
  data_inicio?: string;

  @IsOptional()
  @IsDateString()
  data_fim?: string;
}
