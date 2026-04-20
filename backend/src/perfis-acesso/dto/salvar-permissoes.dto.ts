import { IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NivelPermissao, PermissaoModulo } from '@prisma/client';

export class PermissaoItemDto {
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
}

export class SalvarPermissoesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissaoItemDto)
  permissoes!: PermissaoItemDto[];
}
