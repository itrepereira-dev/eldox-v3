import {
  IsString, IsNotEmpty, MaxLength, IsOptional,
  IsIn, IsEmail, Matches,
} from 'class-validator';

export class CreateFornecedorDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  razao_social!: string;

  @IsOptional() @IsString() @MaxLength(200)
  nome_fantasia?: string;

  @IsOptional() @IsString() @MaxLength(18)
  cnpj?: string;

  @IsOptional() @IsIn(['fabricante', 'distribuidor', 'locadora', 'prestador'])
  tipo?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefone?: string;

  @IsOptional() @IsString() @MaxLength(100)
  responsavel_comercial?: string;

  @IsOptional() @IsString()
  endereco?: string;

  @IsOptional() @IsString() @MaxLength(100)
  cidade?: string;

  @IsOptional() @IsString() @Matches(/^[A-Z]{2}$/)
  uf?: string;

  @IsOptional() @IsString()
  observacoes?: string;
}
