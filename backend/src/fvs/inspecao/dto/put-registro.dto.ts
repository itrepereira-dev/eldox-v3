import { IsNumber, IsEnum, IsOptional, IsString } from 'class-validator';

export class PutRegistroDto {
  @IsNumber()
  servicoId: number;

  @IsNumber()
  itemId: number;

  @IsNumber()
  localId: number;

  @IsEnum(['nao_avaliado', 'conforme', 'nao_conforme', 'excecao'])
  status: 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao';

  @IsOptional()
  @IsString()
  observacao?: string;
}
