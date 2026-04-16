// backend/src/diario/rdo/dto/status-rdo.dto.ts
import { IsEnum, IsString, IsOptional } from 'class-validator';
import type { RdoStatus } from '../types/rdo.types';

export class StatusRdoDto {
  @IsEnum(['revisao', 'aprovado'])
  status: Extract<RdoStatus, 'revisao' | 'aprovado'>;

  @IsString()
  @IsOptional()
  assinatura_base64?: string;
}
