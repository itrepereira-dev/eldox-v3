import { PartialType } from '@nestjs/mapped-types';
import { CreateMaterialDto } from './create-material.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateMaterialDto extends PartialType(CreateMaterialDto) {
  @IsOptional() @IsBoolean()
  ativo?: boolean;
}
