import { IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { AprovacaoModulo, AprovacaoStatus } from '@prisma/client';

export class ListAprovacoesDto {
  @IsOptional()
  @IsEnum(AprovacaoStatus)
  status?: AprovacaoStatus;

  @IsOptional()
  @IsEnum(AprovacaoModulo)
  modulo?: AprovacaoModulo;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  obraId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  solicitanteId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}
