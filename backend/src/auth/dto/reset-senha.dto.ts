import { IsString, Length } from 'class-validator';
import { SenhaForte } from '../../common/decorators/senha-forte.decorator';

export class ResetSenhaDto {
  @IsString()
  @Length(64, 64)
  token!: string;

  @SenhaForte()
  novaSenha!: string;
}
