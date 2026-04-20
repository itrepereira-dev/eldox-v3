// backend/src/fvs/modelos/dto/create-modelo.dto.ts
import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean,
  IsInt, IsPositive, MaxLength, ValidateIf, IsArray,
} from 'class-validator';

export class CreateModeloDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsEnum(['empresa', 'obra'])
  escopo: 'empresa' | 'obra';

  @ValidateIf((o) => o.escopo === 'obra')
  @IsInt()
  @IsPositive()
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

  @IsOptional()
  @IsEnum(['todas', 'apenas_nc', 'nenhuma', 'itens_selecionados'])
  fotosObrigatorias?: 'todas' | 'apenas_nc' | 'nenhuma' | 'itens_selecionados';

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  fotosItensIds?: number[] | null;
}
