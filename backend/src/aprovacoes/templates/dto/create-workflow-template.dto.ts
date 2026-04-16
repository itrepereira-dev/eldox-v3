import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AprovacaoModulo,
  TipoAprovador,
  AcaoVencimento,
  AcaoRejeicao,
} from '@prisma/client';

export class CreateEtapaDto {
  @IsInt()
  @Min(1)
  ordem: number;

  @IsString()
  @MaxLength(200)
  nome: string;

  @IsEnum(TipoAprovador)
  tipoAprovador: TipoAprovador;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  usuarioFixoId?: number;

  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condicao?: { campo: string; operador: string; valor: any } | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  prazoHoras?: number;

  @IsOptional()
  @IsEnum(AcaoVencimento)
  acaoVencimento?: AcaoVencimento;

  @IsOptional()
  @IsEnum(AcaoRejeicao)
  acaoRejeicao?: AcaoRejeicao;
}

export class CreateWorkflowTemplateDto {
  @IsString()
  @MaxLength(200)
  nome: string;

  @IsEnum(AprovacaoModulo)
  modulo: AprovacaoModulo;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEtapaDto)
  etapas: CreateEtapaDto[];
}
