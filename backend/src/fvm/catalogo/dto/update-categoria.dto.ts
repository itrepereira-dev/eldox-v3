import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoriaDto } from './create-categoria.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateCategoriaDto extends PartialType(CreateCategoriaDto) {
  @IsOptional() @IsBoolean()
  ativo?: boolean;
}
