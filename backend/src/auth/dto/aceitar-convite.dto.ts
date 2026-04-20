import { IsString, Length, MinLength } from 'class-validator';
import { SenhaForte } from '../../common/decorators/senha-forte.decorator';

export class AceitarConviteDto {
  @IsString()
  @Length(64, 64)
  token!: string;

  @IsString()
  @MinLength(1)
  nome!: string;

  @SenhaForte()
  senha!: string;
}
