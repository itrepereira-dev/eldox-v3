import { IsInt, Min, IsIn, IsOptional, IsString } from 'class-validator';

export class PutRegistroDto {
  @IsInt() @Min(1)
  item_id!: number;

  @IsIn(['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'])
  status!: string;

  /** Obrigatório quando status = 'nao_conforme' — validado no service */
  @IsOptional() @IsString()
  observacao?: string;
}
