import { IsEmail, IsString, MinLength } from 'class-validator';

export class EsqueciSenhaDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsEmail()
  email!: string;
}
