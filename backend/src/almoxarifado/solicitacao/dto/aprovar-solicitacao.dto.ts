// backend/src/almoxarifado/solicitacao/dto/aprovar-solicitacao.dto.ts
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AprovarSolicitacaoDto {
  @IsIn(['aprovado', 'reprovado'])
  acao!: 'aprovado' | 'reprovado';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
