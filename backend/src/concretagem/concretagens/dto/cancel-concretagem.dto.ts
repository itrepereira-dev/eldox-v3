// backend/src/concretagem/concretagens/dto/cancel-concretagem.dto.ts
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum CancelamentoSolicitante {
  OBRA = 'OBRA',
  CONCRETEIRA = 'CONCRETEIRA',
}

export class CancelConcrtagemDto {
  @IsOptional()
  @IsEnum(CancelamentoSolicitante)
  solicitante?: CancelamentoSolicitante;

  @IsOptional()
  @IsBoolean()
  multa?: boolean;
}
