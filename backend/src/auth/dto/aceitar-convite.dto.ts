import { IsString, Length, MinLength } from 'class-validator';

export class AceitarConviteDto {
  @IsString()
  @Length(64, 64)
  token!: string;

  @IsString()
  @MinLength(1)
  nome!: string;

  @IsString()
  @MinLength(8)
  senha!: string;
}
