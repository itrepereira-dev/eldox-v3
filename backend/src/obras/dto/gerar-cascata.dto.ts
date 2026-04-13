import {
  IsString, IsNotEmpty, IsEnum, IsArray, ValidateNested,
  IsOptional, IsInt, IsBoolean, Min, Max, MaxLength,
  IsNumber, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export type EstrategiaGeracao = 'generica' | 'edificacao' | 'linear' | 'instalacao';

// ─── Genérica ───────────────────────────────────────────────
export class NivelGenericoDto {
  @IsInt() @Min(1) @Max(6)
  nivel: number;

  @IsInt() @Min(1) @Max(1000)
  qtde: number;

  @IsString() @MaxLength(30)
  prefixo: string;

  @IsOptional() @IsInt() @Min(1)
  inicioEm?: number;

  // tipoUnidade vai em dadosExtras — não existe como coluna direta em ObraLocal v3
  @IsOptional() @IsString() @MaxLength(20)
  tipoUnidade?: string; // salvo em dadosExtras: { tipoUnidade } no service
}

export class GerarGenericaDto {
  estrategia: 'generica';

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => NivelGenericoDto)
  niveis: NivelGenericoDto[];
}

// ─── Edificação ──────────────────────────────────────────────
export class GerarEdificacaoDto {
  estrategia: 'edificacao';

  @IsOptional() @IsString() @MaxLength(50)
  condPrefixo?: string;

  @IsOptional() @IsInt() @Min(1)
  condQtd?: number;

  @IsOptional() @IsInt() @Min(1)
  condInicio?: number;

  @IsString() @MaxLength(50)
  blocoPrefixo: string;

  @IsEnum(['letra', 'numero'])
  blocoTipo: 'letra' | 'numero';

  @IsOptional() @IsString() @MaxLength(1)
  blocoLetraInicio?: string;

  @IsOptional() @IsInt() @Min(1)
  blocoNumInicio?: number;

  @IsInt() @Min(1) @Max(100)
  blocoQtd: number;

  @IsEnum(['andar', 'sequencial'])
  modo: 'andar' | 'sequencial';

  @IsOptional() @IsInt()
  andarInicio?: number;

  @IsOptional() @IsInt() @Min(0)
  andarQtd?: number;

  @IsOptional() @IsInt() @Min(0)
  unidadesAndar?: number;

  @IsOptional() @IsString() @MaxLength(10)
  unidadePrefixo?: string;

  @IsOptional() @IsInt() @Min(1)
  unidadesTotal?: number;

  @IsOptional() @IsArray()
  areasComuns?: Array<'halls' | 'escadas' | 'elevadores' | 'fachadas' | 'cobertura' | 'garagem'>;

  @IsOptional() @IsArray()
  areasGlobais?: Array<'lazer' | 'sistemas'>;
}

// ─── Linear ──────────────────────────────────────────────────
export class TrechoDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome: string;

  @IsOptional() @IsNumber()
  kmInicio?: number;

  @IsOptional() @IsNumber()
  kmFim?: number;

  @IsOptional() @IsInt() @Min(0)
  pvs?: number;
}

export class ElementoLinearDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome: string;

  @IsOptional() @IsString()
  trecho?: string;

  @IsOptional() @IsNumber()
  km?: number;
}

export class GerarLinearDto {
  estrategia: 'linear';

  @IsOptional() @IsString() @MaxLength(10)
  prefixoPV?: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TrechoDto)
  trechos: TrechoDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ElementoLinearDto)
  elementos?: ElementoLinearDto[];
}

// ─── Instalação ───────────────────────────────────────────────
export class ModuloInstalacaoDto {
  @IsOptional() @IsString() @MaxLength(50)
  prefixo?: string;

  @IsOptional() @IsString() @MaxLength(100)
  nome?: string;

  @IsOptional() @IsInt() @Min(1) @Max(200)
  qtde?: number;
}

export class AreaInstalacaoDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nome: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => ModuloInstalacaoDto)
  modulos: ModuloInstalacaoDto[];
}

export class GerarInstalacaoDto {
  estrategia: 'instalacao';

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AreaInstalacaoDto)
  areas: AreaInstalacaoDto[];
}

// ─── DTO principal enviado pelo frontend ─────────────────────
export class GerarCascataDto {
  @IsEnum(['generica', 'edificacao', 'linear', 'instalacao'])
  estrategia: EstrategiaGeracao;

  payload: GerarGenericaDto | GerarEdificacaoDto | GerarLinearDto | GerarInstalacaoDto;
}
