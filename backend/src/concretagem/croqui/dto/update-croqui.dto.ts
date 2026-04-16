// backend/src/concretagem/croqui/dto/update-croqui.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCroquiDto } from './create-croqui.dto';

export class UpdateCroquiDto extends PartialType(
  OmitType(CreateCroquiDto, ['ia_confianca'] as const),
) {}
