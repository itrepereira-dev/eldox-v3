// backend/src/planos-acao/dto/update-pa.dto.ts
import {
  IsString, IsOptional, IsIn, IsNumber, IsDateString, MaxLength, Min,
} from 'class-validator';

export class UpdatePaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

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
  camposExtras?: Record<string, unknown>;
}
