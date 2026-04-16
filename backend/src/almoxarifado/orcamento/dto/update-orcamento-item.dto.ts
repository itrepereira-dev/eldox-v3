// backend/src/almoxarifado/orcamento/dto/update-orcamento-item.dto.ts
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateOrcamentoItemDto {
  @IsInt()
  @IsOptional()
  catalogo_id?: number;

  @IsString()
  @IsOptional()
  unidade?: string;

  @IsNumber()
  @IsOptional()
  quantidade?: number;

  @IsNumber()
  @IsOptional()
  preco_unitario?: number;

  @IsInt()
  @IsOptional()
  mes_previsto?: number;

  @IsString()
  @IsOptional()
  etapa?: string;
}
