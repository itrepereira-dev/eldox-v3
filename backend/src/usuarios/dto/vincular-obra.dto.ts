import { IsInt } from 'class-validator';

export class VincularObraDto {
  @IsInt()
  obraId!: number;
}
