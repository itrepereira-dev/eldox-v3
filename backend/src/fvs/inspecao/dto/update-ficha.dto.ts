import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateFichaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(['rascunho', 'em_inspecao', 'concluida', 'aguardando_parecer', 'aprovada'])
  status?: 'rascunho' | 'em_inspecao' | 'concluida' | 'aguardando_parecer' | 'aprovada';
}
