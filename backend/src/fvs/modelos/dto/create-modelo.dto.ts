// backend/src/fvs/modelos/dto/create-modelo.dto.ts
import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean,
  IsNumber, MaxLength, ValidateIf,
} from 'class-validator';

export class CreateModeloDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsEnum(['empresa', 'obra'])
  escopo: 'empresa' | 'obra';

  @ValidateIf((o) => o.escopo === 'obra')
  @IsNumber()
  obraId?: number;

  @IsEnum(['livre', 'pbqph'])
  regime: 'livre' | 'pbqph';

  @IsOptional()
  @IsBoolean()
  exigeRo?: boolean;

  @IsOptional()
  @IsBoolean()
  exigeReinspecao?: boolean;

  @IsOptional()
  @IsBoolean()
  exigeParecer?: boolean;
}
