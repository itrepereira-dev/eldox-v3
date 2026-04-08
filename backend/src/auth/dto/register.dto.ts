import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @IsNotEmpty()
  tenantNome: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  tenantSlug: string;

  @IsString()
  @IsNotEmpty()
  adminNome: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  adminSenha: string;
}
