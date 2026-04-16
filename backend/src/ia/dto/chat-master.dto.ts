import { IsString, IsNotEmpty, MaxLength, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMensagemDto {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatMasterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChatMensagemDto)
  historico?: ChatMensagemDto[];

  @IsString()
  @IsOptional()
  rota_atual?: string; // rota atual do usuário para contexto
}
