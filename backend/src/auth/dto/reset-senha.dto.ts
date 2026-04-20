import { IsString, Length, MinLength } from 'class-validator';

export class ResetSenhaDto {
  @IsString()
  @Length(64, 64)
  token!: string;

  @IsString()
  @MinLength(8)
  novaSenha!: string;
}
