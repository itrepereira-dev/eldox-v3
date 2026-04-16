import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { AprovacaoModulo } from '@prisma/client';

export class CreateAprovacaoDto {
  @IsEnum(AprovacaoModulo)
  modulo: AprovacaoModulo;

  @IsInt()
  entidadeId: number;

  @IsString()
  @MaxLength(50)
  entidadeTipo: string;

  @IsString()
  @MaxLength(300)
  titulo: string;

  @IsOptional()
  @IsInt()
  obraId?: number;

  // snapshotJson é passado internamente pelo módulo chamador, não vem do request
  snapshotJson?: Record<string, unknown>;
}
