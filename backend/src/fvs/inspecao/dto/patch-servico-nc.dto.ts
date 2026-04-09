import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class PatchServicoNcDto {
  @IsOptional()
  @IsString()
  acao_corretiva?: string;

  @IsOptional()
  @IsBoolean()
  desbloquear?: boolean;
}
