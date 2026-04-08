// src/ged/dto/aprovar.dto.ts
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { GedStatusVersao } from '../types/ged.types';

// Status permitidos ao aprovar: IFC, IFP ou AS_BUILT
type StatusAprovacao = Extract<GedStatusVersao, 'IFC' | 'IFP' | 'AS_BUILT'>;

export class AprovarDto {
  @IsEnum(['IFC', 'IFP', 'AS_BUILT'])
  statusAprovado: StatusAprovacao;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}
