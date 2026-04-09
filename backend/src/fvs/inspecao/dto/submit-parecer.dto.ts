import { IsEnum, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemReferenciadoDto {
  @IsOptional() registro_id?: number;
  @IsOptional() item_descricao?: string;
  @IsOptional() servico_nome?: string;
}

export class SubmitParecerDto {
  @IsEnum(['aprovado', 'rejeitado'])
  decisao: 'aprovado' | 'rejeitado';

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemReferenciadoDto)
  itens_referenciados?: ItemReferenciadoDto[];
}
