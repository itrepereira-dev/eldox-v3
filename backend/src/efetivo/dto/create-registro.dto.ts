// backend/src/efetivo/dto/create-registro.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateItemDto } from './create-item.dto';

export class CreateRegistroDto {
  @IsString()
  @IsNotEmpty()
  data: string;

  @IsEnum(['INTEGRAL', 'MANHA', 'TARDE', 'NOITE'])
  turno: 'INTEGRAL' | 'MANHA' | 'TARDE' | 'NOITE';

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  itens: CreateItemDto[];
}
