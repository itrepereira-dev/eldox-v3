import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum([
    'TECNICO',
    'ENGENHEIRO',
    'ADMIN_TENANT',
    'LABORATORIO',
    'VISITANTE',
  ])
  role?: Role;
}
