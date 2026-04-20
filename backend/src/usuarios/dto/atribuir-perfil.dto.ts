import { IsInt, IsOptional } from 'class-validator';

export class AtribuirPerfilDto {
  // null / undefined desvincula o perfil
  @IsOptional()
  @IsInt()
  perfilAcessoId?: number | null;
}
