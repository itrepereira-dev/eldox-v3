// backend/src/fvs/dashboard/dto/dashboard-graficos-query.dto.ts
import { IsDateString, IsIn, IsOptional, IsArray, IsInt } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class DashboardGraficosQueryDto {
  @IsDateString()
  data_inicio: string; // ISO date string: "2025-01-01"

  @IsDateString()
  data_fim: string; // ISO date string: "2025-12-31"

  @IsOptional()
  @IsIn(['semana', 'mes'])
  granularidade?: 'semana' | 'mes' = 'semana';

  // Accept repeated query param: ?servico_ids=1&servico_ids=2
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  servico_ids?: number[];
}
