import { IsIn, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class ConcluirInspecaoDto {
  /**
   * Decisão final do inspetor.
   * - aprovado: todos os itens críticos e maiores conformes
   * - aprovado_com_ressalva: NC menor, liberado pelo engenheiro
   * - quarentena: NC mas material pode aguardar laudo
   * - reprovado: NC crítica — devolução obrigatória
   */
  @IsIn(['aprovado', 'aprovado_com_ressalva', 'quarentena', 'reprovado'])
  decisao!: string;

  /** Obrigatório para quarentena e reprovado */
  @IsOptional() @IsString()
  observacao_geral?: string;

  /** Obrigatório se decisao = 'quarentena' */
  @IsOptional() @IsString()
  quarentena_motivo?: string;

  /** Obrigatório se decisao = 'quarentena' */
  @IsOptional() @IsInt() @Min(1)
  quarentena_prazo_dias?: number;
}
