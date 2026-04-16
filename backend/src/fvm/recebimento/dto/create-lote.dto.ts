import {
  IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min,
  IsDateString, IsNumber, IsPositive,
} from 'class-validator';

export class CreateLoteDto {
  @IsInt() @Min(1)
  material_id!: number;

  @IsInt() @Min(1)
  fornecedor_id!: number;

  @IsString() @IsNotEmpty() @MaxLength(60)
  numero_nf!: string;

  @IsDateString()
  data_entrega!: string;

  @IsNumber() @IsPositive()
  quantidade!: number;

  @IsString() @IsNotEmpty() @MaxLength(20)
  unidade!: string;

  // Campos opcionais (colapsados no modal)

  @IsOptional() @IsString() @MaxLength(60)
  numero_pedido?: string;

  @IsOptional() @IsString() @MaxLength(60)
  lote_fabricante?: string;

  @IsOptional() @IsDateString()
  data_fabricacao?: string;

  @IsOptional() @IsDateString()
  validade?: string;

  @IsOptional() @IsString() @MaxLength(8) // HH:MM:SS
  hora_chegada?: string;

  @IsOptional() @IsNumber() @IsPositive()
  quantidade_nf?: number;

  @IsOptional() @IsNumber() @IsPositive()
  quantidade_recebida?: number;

  // Concreto usinado
  @IsOptional() @IsString() @MaxLength(8)
  hora_saida_usina?: string;

  @IsOptional() @IsNumber() @IsPositive()
  slump_especificado?: number;

  @IsOptional() @IsNumber() @IsPositive()
  slump_medido?: number;
}
