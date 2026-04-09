import { IsEnum, IsOptional, IsString, IsArray, ValidateNested, IsInt, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemReferenciadoDto {
  @IsOptional()
  @IsInt()
  registro_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  item_descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  servico_nome?: string;
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
