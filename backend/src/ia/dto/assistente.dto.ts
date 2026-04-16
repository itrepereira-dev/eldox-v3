import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AssistenteFvsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  contexto: string; // JSON string com dados da inspeção em andamento
}
