// backend/src/ensaios/dto/revisar-laudo.dto.ts
import { IsEnum, IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export enum SituacaoRevisao {
  APROVADO  = 'APROVADO',
  REPROVADO = 'REPROVADO',
  PENDENTE  = 'PENDENTE', // só para reabrir
}

export class RevisarLaudoDto {
  @IsEnum(SituacaoRevisao)
  situacao!: SituacaoRevisao;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsOptional()
  @IsBoolean()
  reabrir?: boolean; // apenas admin_tenant
}
