import { PartialType } from '@nestjs/mapped-types';
import { CreateObraDto } from './create-obra.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { StatusObra } from '@prisma/client';

export class UpdateObraDto extends PartialType(CreateObraDto) {
  @IsOptional()
  @IsEnum(StatusObra)
  status?: StatusObra;
}
