// src/ged/dto/create-transmittal.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsEnum,
  ValidateNested,
  IsEmail,
  MaxLength,
  MinLength,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { GedTransmittalFinalidade } from '../types/ged.types';

export class TransmittalItemDto {
  @IsInt()
  @Min(1)
  versaoId: number;

  @IsEnum(['PARA_APROVACAO', 'PARA_INFORMACAO', 'PARA_CONSTRUCAO', 'PARA_COMPRA'])
  finalidade: GedTransmittalFinalidade;
}

export class TransmittalDestinatarioDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  usuarioId?: number;

  @IsOptional()
  @IsEmail()
  emailExterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  // Canal de envio: EMAIL, WHATSAPP, INTERNO
  @IsEnum(['EMAIL', 'WHATSAPP', 'INTERNO'])
  canal: string;
}

export class CreateTransmittalDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  assunto: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransmittalItemDto)
  itens: TransmittalItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransmittalDestinatarioDto)
  destinatarios: TransmittalDestinatarioDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  transmittalAnteriorId?: number;
}
