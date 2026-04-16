import { IsIn, IsOptional, IsString } from 'class-validator';

export class DecidirAprovacaoDto {
  @IsIn(['APROVADO', 'REPROVADO'])
  decisao: 'APROVADO' | 'REPROVADO';

  @IsOptional()
  @IsString()
  observacao?: string;
}
