import { IsEnum, IsString, IsNotEmpty, MinLength, MaxLength, IsInt, IsPositive, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export enum DecisaoQuarentena {
  Aprovado           = 'aprovado',
  AprovadoComRessalva = 'aprovado_com_ressalva',
  Reprovado          = 'reprovado',
}

export class LiberarQuarentenaDto {
  /**
   * Decisão da liberação de quarentena.
   * Transições válidas: quarentena → aprovado | aprovado_com_ressalva | reprovado
   */
  @IsEnum(DecisaoQuarentena)
  decisao!: DecisaoQuarentena;

  /** Justificativa obrigatória para auditoria */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  observacao!: string;

  /** FK para fvm_evidencias — deve pertencer ao mesmo tenant */
  @IsOptional()
  @IsInt()
  @IsPositive()
  evidencia_id?: number;
}
