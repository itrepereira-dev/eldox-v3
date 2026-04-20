import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CriarUsuarioDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  nome!: string;

  @IsEnum([
    'TECNICO',
    'ENGENHEIRO',
    'ADMIN_TENANT',
    'LABORATORIO',
    'VISITANTE',
  ])
  role!: Role;

  @IsOptional()
  @IsInt()
  perfilAcessoId?: number;
}
