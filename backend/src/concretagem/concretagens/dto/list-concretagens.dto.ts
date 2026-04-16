// backend/src/concretagem/concretagens/dto/list-concretagens.dto.ts
import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { StatusConcretagem } from './update-concretagem.dto';

export class ListConcrtagensDto {
  @IsOptional()
  @IsEnum(StatusConcretagem)
  status?: StatusConcretagem;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
