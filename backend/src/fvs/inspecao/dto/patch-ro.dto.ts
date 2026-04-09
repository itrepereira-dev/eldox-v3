import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';

export class PatchRoDto {
  @IsOptional()
  @IsEnum(['real', 'potencial'])
  tipo?: 'real' | 'potencial';

  @IsOptional()
  @IsNumber()
  responsavel_id?: number;

  @IsOptional()
  @IsString()
  o_que_aconteceu?: string;

  @IsOptional()
  @IsString()
  acao_imediata?: string;

  @IsOptional()
  @IsEnum(['mao_obra', 'material', 'metodo', 'gestao', 'medida', 'meio_ambiente', 'maquina'])
  causa_6m?: string;

  @IsOptional()
  @IsString()
  justificativa_causa?: string;
}
