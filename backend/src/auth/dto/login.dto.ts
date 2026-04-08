import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  senha: string;
}
