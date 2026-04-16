import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

/**
 * Payload mínimo para criação inline de fornecedor no NovoLoteModal.
 * Elimina o bloqueio de 7 passos ao receber o primeiro lote de um novo fornecedor.
 */
export class CreateFornecedorRapidoDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  razao_social!: string;

  @IsOptional() @IsString() @MaxLength(18)
  cnpj?: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefone?: string;
}
