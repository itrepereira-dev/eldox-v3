// backend/src/fvs/inspecao/dto/put-registro.dto.ts
import { IsNumber, IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';

const STATUS_REGISTRO_VALORES = [
  'nao_avaliado',
  'conforme',
  'nao_conforme',
  'excecao',
  'conforme_apos_reinspecao',
  'nc_apos_reinspecao',
  'liberado_com_concessao',
  'retrabalho',
] as const;

export class PutRegistroDto {
  @IsNumber()
  servicoId: number;

  @IsNumber()
  itemId: number;

  @IsNumber()
  localId: number;

  @IsEnum(STATUS_REGISTRO_VALORES)
  status: typeof STATUS_REGISTRO_VALORES[number];

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ciclo?: number;
}
