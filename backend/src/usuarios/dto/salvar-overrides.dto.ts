import { IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NivelPermissao, PermissaoModulo } from '@prisma/client';

export class OverrideItemDto {
  @IsEnum([
    'CONCRETAGEM',
    'NC',
    'RO',
    'LAUDOS',
    'OBRAS',
    'USUARIOS',
    'RELATORIOS',
  ])
  modulo!: PermissaoModulo;

  @IsEnum(['VISUALIZAR', 'OPERAR', 'APROVAR', 'ADMINISTRAR'])
  nivel!: NivelPermissao;

  @IsBoolean()
  concedido!: boolean;
}

export class SalvarOverridesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OverrideItemDto)
  overrides!: OverrideItemDto[];
}
