import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';

export class GerarCatalogoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tipo_obra: string; // ex: "Residencial Vertical"

  @IsString()
  @IsOptional()
  @MaxLength(500)
  servicos?: string; // ex: "alvenaria, revestimento, pintura"

  @IsString()
  @IsOptional()
  @MaxLength(200)
  normas?: string; // ex: "NBR 15575, PBQP-H"

  @IsString()
  @IsIn(['basico', 'intermediario', 'avancado'])
  nivel_detalhe: string;
}
