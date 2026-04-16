// backend/src/efetivo/dto/create-funcao.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateFuncaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;
}
