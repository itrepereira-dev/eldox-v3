// backend/src/concretagem/corpos-de-prova/dto/create-cp.dto.ts
import {
  IsInt,
  IsOptional,
  IsDateString,
  IsIn,
  IsString,
  Min,
  IsArray,
} from 'class-validator';

export class CreateCpDto {
  @IsInt()
  caminhao_id!: number;

  @IsOptional()
  @IsIn([3, 7, 28, 63])
  @IsInt()
  idade_dias?: number; // se omitido, cria CP para 3, 7 e 28 dias

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  idades?: number[]; // alternative to idade_dias: specify multiple ages at once

  @IsDateString()
  data_moldagem!: string;

  @IsOptional()
  @IsInt()
  laboratorio_id?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class CreateCpAulsoDto {
  @IsInt()
  caminhao_id!: number;

  @IsIn([3, 7, 28])
  @IsInt()
  idade_dias!: number;

  @IsDateString()
  data_moldagem!: string;

  @IsOptional()
  @IsInt()
  laboratorio_id?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
