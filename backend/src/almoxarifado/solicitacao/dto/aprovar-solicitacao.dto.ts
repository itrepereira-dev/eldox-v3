// backend/src/almoxarifado/solicitacao/dto/aprovar-solicitacao.dto.ts

export class AprovarSolicitacaoDto {
  acao!: 'aprovado' | 'reprovado';
  observacao?: string;
}
