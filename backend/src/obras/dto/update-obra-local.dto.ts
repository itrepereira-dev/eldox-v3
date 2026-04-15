import { IsString, IsOptional, IsInt, IsObject, IsEnum } from 'class-validator';

export class UpdateObraLocalDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(['PENDENTE', 'EM_EXECUCAO', 'CONCLUIDO', 'ENTREGUE', 'SUSPENSO'])
  status?: 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDO' | 'ENTREGUE' | 'SUSPENSO';

  @IsOptional()
  @IsInt()
  ordem?: number;

  @IsOptional()
  @IsObject()
  dadosExtras?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  dataInicioPrevista?: string;

  @IsOptional()
  @IsString()
  dataFimPrevista?: string;

  @IsOptional()
  @IsInt()
  plantaBaixaId?: number; // FK para GED (futuro)
}
