import { IsString, MinLength, MaxLength } from 'class-validator';

// Cancelamento de versão requer motivo escrito — fica no audit log pra
// investigar depois se houver questionamento (exigência PBQP-H).
export class CancelarDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo: string;
}
