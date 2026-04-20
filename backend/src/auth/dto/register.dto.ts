import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { SenhaForte } from '../../common/decorators/senha-forte.decorator';

export class RegisterTenantDto {
  @IsString()
  @IsNotEmpty()
  tenantNome!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  tenantSlug!: string;

  @IsString()
  @IsNotEmpty()
  adminNome!: string;

  @IsEmail()
  adminEmail!: string;

  @SenhaForte()
  adminSenha!: string;
}
