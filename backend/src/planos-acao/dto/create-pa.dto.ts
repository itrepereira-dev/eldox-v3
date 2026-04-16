// backend/src/planos-acao/dto/create-pa.dto.ts
import {
  IsNumber, IsString, IsNotEmpty, IsOptional, IsIn, IsDateString, MaxLength, Min,
} from 'class-validator';

export class CreatePaDto {
  @IsNumber()
  @Min(1)
  cicloId: number;

  @IsNumber()
  @Min(1)
  obraId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsIn(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'])
  prioridade?: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

  @IsOptional()
  @IsNumber()
  @Min(1)
  responsavelId?: number;

  @IsOptional()
  @IsDateString()
  prazo?: string;

  @IsOptional()
  @IsIn(['INSPECAO_FVS', 'NC_FVS', 'MANUAL'])
  origemTipo?: 'INSPECAO_FVS' | 'NC_FVS' | 'MANUAL';

  @IsOptional()
  @IsNumber()
  @Min(1)
  origemId?: number;

  @IsOptional()
  camposExtras?: Record<string, unknown>;
}
