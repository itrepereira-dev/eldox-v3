// backend/src/fvm/recebimento/dto/dashboard-query.dto.ts
import { IsOptional, IsDateString } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  data_inicio?: string;

  @IsOptional()
  @IsDateString()
  data_fim?: string;
}
