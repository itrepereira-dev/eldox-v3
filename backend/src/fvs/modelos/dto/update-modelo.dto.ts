// backend/src/fvs/modelos/dto/update-modelo.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateModeloDto } from './create-modelo.dto';

export class UpdateModeloDto extends PartialType(CreateModeloDto) {}
