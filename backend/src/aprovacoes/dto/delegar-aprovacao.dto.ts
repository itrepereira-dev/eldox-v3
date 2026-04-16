import { IsInt, IsOptional, IsString } from 'class-validator';

export class DelegarAprovacaoDto {
  @IsInt()
  novoAprovadorId: number;

  @IsOptional()
  @IsString()
  observacao?: string;
}
